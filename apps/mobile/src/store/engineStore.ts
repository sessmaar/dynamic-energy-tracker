import {
  type ActivityBlock, type ActivityLevel, type Composition, type IntakeEntry, type IsoDate,
  type Kg, type KcalDay, type Sex, type UserProfile, type WeeklyTdeeResult, type WeightEntry,
  DEFAULT_ACTIVITY_LEVEL, alphaForDaysWithBoth, cm, computeWeeklyTdee, dailyTargetFromTdee,
  distributeWeeklyTarget, fullTrajectory, isoDate, kcalDay, latestTrendWeight,
  localDateInTimezone, resolveComposition, restingEnergy, seedTdee, totalActiveCalories,
  unit, updateTdeePosterior,
} from "@dynamic-energy/engine";
import type { BodyMeasurement, MealSummary, ProgressPhoto, RecipeSummary } from "@dynamic-energy/data";
import { create } from "zustand";
import { repos, supabase } from "@/lib/supabase";
import { type Assessment } from "@/onboarding/assessment";
import { buildOnboardingWrite } from "@/onboarding/persistence";
import { saveReminderPrefs } from "@/onboarding/reminders";

/**
 * Live store backed by Supabase via @dynamic-energy/data. Raw logs are
 * the only persisted state — TDEE is *always* recomputed in-memory from
 * the latest weight + intake history. Weekly check-ins, when the user
 * accepts them, also write a row to engine_state_weekly as a frozen
 * audit trail (separate from the live derivation).
 *
 * Every "what is today" calculation runs through the user's profile
 * timezone, not UTC, so logging at 23:00 in PST doesn't land on the
 * next calendar day.
 */

const DEFAULT_TZ = "UTC";

interface EngineState {
  userId: string | null;
  loading: boolean;
  error: string | null;

  profile: UserProfile | null;
  dateOfBirth: string | null;
  initialWeightKg: number | null;
  /** IANA zone (e.g. America/Los_Angeles). Falls back to UTC pre-hydration. */
  timezone: string;
  /** Lifestyle tier used to seed the cold-start TDEE prior (BMR × PAL). */
  activityLevel: ActivityLevel;
  goalKgPerWeek: number;

  weights: WeightEntry[];
  intake: IntakeEntry[];
  activity: ActivityBlock[];
  todayMeals: MealSummary[];
  recipes: RecipeSummary[];
  /** Most recent body-composition assessment, or null. */
  latestMeasurement: BodyMeasurement | null;
  /** Derived composition (body-fat + lean mass) vs current trend weight. */
  composition: Composition | null;
  progressPhotos: ProgressPhoto[];
  /** Macro targets in grams, or null when user hasn't set them. */
  macroTargets: { proteinG: number | null; carbsG: number | null; fatG: number | null };

  tdee: KcalDay | null;
  lastCheckin: WeeklyTdeeResult | null;

  hydrate: (userId: string) => Promise<void>;
  reset: () => void;

  setProfile: (input: {
    sex: Sex;
    dateOfBirth: string;
    heightCm: number;
    initialWeightKg: number;
    activityLevel: ActivityLevel;
    goalKgPerWeek: number;
    timezone?: string;
  }) => Promise<void>;

  /** Persist a full onboarding assessment, then hydrate. */
  completeOnboarding: (assessment: Assessment) => Promise<void>;

  logWeight: (weightKg: number, date?: string) => Promise<void>;
  logIntake: (calories: number, date?: string) => Promise<void>;
  logActivity: (input: {
    activityType: string;
    metValue: number;
    minutes: number;
    date?: string;
  }) => Promise<void>;

  /**
   * Log a body-composition assessment. Tape circumferences and/or a
   * directly-measured body-fat fraction (0..1) are all optional; the
   * engine resolves whatever is present into lean mass for the formula.
   */
  logComposition: (input: {
    neckCm?: number | null;
    waistCm?: number | null;
    hipCm?: number | null;
    weightKg?: number | null;
    bodyFatPct?: number | null;
    note?: string | null;
    date?: string;
  }) => Promise<void>;

  /** Upload a progress photo to the private bucket and record the pointer. */
  addProgressPhoto: (input: {
    body: Blob | ArrayBuffer | Uint8Array;
    ext: string;
    contentType: string;
    note?: string | null;
    date?: string;
  }) => Promise<void>;

  deleteMeal: (mealId: string) => Promise<void>;

  /**
   * Run the engine over the given Monday→Sunday window. Persists the
   * audit row to engine_state_weekly when `accept` is true.
   */
  runWeeklyCheckin: (weekStart: string, weekEnd: string, opts?: { accept?: boolean }) => Promise<WeeklyTdeeResult | null>;

  /** Stream all the user's data into a JSON blob for export. */
  exportData: () => Promise<string>;

  /** Delete the auth user (cascades to all owned rows). */
  deleteAccount: () => Promise<void>;
}

const localToday = (timezone: string): IsoDate => localDateInTimezone(timezone);

const ninetyDaysAgo = (timezone: string): IsoDate => {
  const today = localToday(timezone);
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 90);
  return isoDate(d.toISOString().slice(0, 10));
};

/**
 * Resolve the latest body-composition assessment into a `Composition`
 * (body-fat fraction + lean mass) against the *current* trend weight, so
 * the resting-energy model uses up-to-date lean mass. Returns null when
 * there's no usable measurement, in which case callers fall back to
 * Mifflin–St Jeor. All the science lives in the engine's
 * `resolveComposition`; this only brands the raw row values.
 */
const resolveStateComposition = (
  profile: UserProfile | null,
  trend: Kg | null,
  m: BodyMeasurement | null,
): Composition | null => {
  if (!profile || !trend || !m) return null;
  return resolveComposition({
    sex: profile.sex,
    heightCm: profile.heightCm,
    weightKg: trend,
    neckCm: m.neckCm != null ? cm(m.neckCm) : undefined,
    waistCm: m.waistCm != null ? cm(m.waistCm) : undefined,
    hipCm: m.hipCm != null ? cm(m.hipCm) : undefined,
    directBodyFatPct: m.bodyFatPct != null ? unit(m.bodyFatPct) : undefined,
  });
};

/**
 * Re-derive TDEE from the current store snapshot. Walks each weekly
 * window from oldest → newest applying the Bayesian update; falls back
 * to the lifestyle-matched cold-start prior (RMR × PAL) when there are
 * no completed weeks. RMR uses Katch–McArdle when a composition is
 * available, else Mifflin–St Jeor.
 */
const deriveTdee = (
  s: Pick<EngineState, "profile" | "weights" | "intake" | "timezone" | "activityLevel" | "composition">,
): KcalDay | null => {
  if (!s.profile || s.weights.length === 0) return null;
  const trend = latestTrendWeight(s.weights);
  if (!trend) return null;

  const seed = seedTdee(s.profile, trend, s.activityLevel, s.composition);

  const earliestDate = s.weights[0]!.date;
  const start = new Date(`${earliestDate}T00:00:00Z`);
  const day = start.getUTCDay();
  const delta = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  start.setUTCDate(start.getUTCDate() + delta);

  const todayLocal = localToday(s.timezone);
  const end = new Date(`${todayLocal}T00:00:00Z`);

  let prior = seed;
  let cursor = new Date(start);
  while (true) {
    const wkEnd = new Date(cursor);
    wkEnd.setUTCDate(wkEnd.getUTCDate() + 6);
    if (wkEnd > end) break;
    const wkStart = cursor.toISOString().slice(0, 10);
    const wkEndStr = wkEnd.toISOString().slice(0, 10);
    const wk = computeWeeklyTdee(isoDate(wkStart), isoDate(wkEndStr), s.intake, s.weights);
    const u = updateTdeePosterior(prior, wk);
    prior = u.posterior;
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return prior;
};

export const useEngine = create<EngineState>((set, get) => ({
  userId: null,
  loading: false,
  error: null,
  profile: null,
  dateOfBirth: null,
  initialWeightKg: null,
  timezone: DEFAULT_TZ,
  activityLevel: DEFAULT_ACTIVITY_LEVEL,
  goalKgPerWeek: 0,
  weights: [],
  intake: [],
  activity: [],
  todayMeals: [],
  recipes: [],
  latestMeasurement: null,
  composition: null,
  progressPhotos: [],
  macroTargets: { proteinG: null, carbsG: null, fatG: null },
  tdee: null,
  lastCheckin: null,

  hydrate: async (userId) => {
    set({ loading: true, error: null, userId });
    try {
      const account = await repos.profile.getAccount(userId);
      const tz = account?.timezone ?? DEFAULT_TZ;
      const since = ninetyDaysAgo(tz);
      const todayIso = localToday(tz);
      const [goalWithMacros, weights, intake, activity, todayMeals, recipes, latestMeasurement, progressPhotos] =
        await Promise.all([
          repos.goal.getActiveWithMacros(userId),
          repos.weight.listSince(userId, since),
          repos.intake.listSince(userId, since),
          repos.activity.listSince(userId, since),
          repos.meal.listForDate(userId, todayIso),
          repos.recipe.list(userId),
          repos.bodyMeasurement.latest(userId),
          repos.progressPhoto.list(userId),
        ]);
      const goal = goalWithMacros?.weekly ?? null;
      const activityLevel = account?.activityLevel ?? DEFAULT_ACTIVITY_LEVEL;
      const profile = account?.profile ?? null;
      const composition = resolveStateComposition(profile, latestTrendWeight(weights), latestMeasurement);
      const snapshot = {
        profile,
        weights,
        intake,
        timezone: tz,
        activityLevel,
        composition,
      };
      set({
        profile,
        dateOfBirth: account?.dateOfBirth ?? null,
        initialWeightKg: account?.initialWeightKg ?? null,
        timezone: tz,
        activityLevel,
        goalKgPerWeek: goal?.kgPerWeek ?? 0,
        macroTargets: {
          proteinG: goalWithMacros?.proteinG ?? null,
          carbsG: goalWithMacros?.carbsG ?? null,
          fatG: goalWithMacros?.fatG ?? null,
        },
        weights, intake, activity, todayMeals, recipes,
        latestMeasurement, progressPhotos, composition,
        tdee: deriveTdee(snapshot),
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  reset: () => set({
    userId: null, profile: null, dateOfBirth: null, initialWeightKg: null,
    timezone: DEFAULT_TZ, activityLevel: DEFAULT_ACTIVITY_LEVEL, goalKgPerWeek: 0,
    macroTargets: { proteinG: null, carbsG: null, fatG: null },
    weights: [], intake: [], activity: [], todayMeals: [], recipes: [],
    latestMeasurement: null, composition: null, progressPhotos: [],
    tdee: null, lastCheckin: null, error: null,
  }),

  setProfile: async (input) => {
    const userId = get().userId;
    if (!userId) throw new Error("Not signed in");
    const tz = input.timezone ?? get().timezone;
    await repos.profile.upsert({
      userId,
      sex: input.sex,
      dateOfBirth: input.dateOfBirth,
      heightCm: input.heightCm,
      initialWeightKg: input.initialWeightKg,
      activityLevel: input.activityLevel,
      timezone: tz,
    });
    const goalType: "cut" | "maintain" | "gain" =
      input.goalKgPerWeek === 0 ? "maintain" : input.goalKgPerWeek < 0 ? "cut" : "gain";
    await repos.goal.setActive({
      userId,
      goalType,
      rateKgPerWeek: input.goalKgPerWeek,
      startDate: localToday(tz),
    });
    await repos.weight.log({
      userId,
      date: localToday(tz),
      weightKg: input.initialWeightKg,
    });
    await get().hydrate(userId);
  },

  completeOnboarding: async (assessment) => {
    const userId = get().userId;
    if (!userId) throw new Error("Not signed in");
    const tz = Intl?.DateTimeFormat?.().resolvedOptions().timeZone ?? "UTC";
    const today = localDateInTimezone(tz);
    const w = buildOnboardingWrite(assessment, userId, tz, today);

    await repos.profile.upsert({
      userId: w.profile.userId,
      sex: w.profile.sex,
      dateOfBirth: w.profile.dateOfBirth,
      heightCm: w.profile.heightCm,
      initialWeightKg: w.profile.initialWeightKg,
      activityLevel: w.profile.activityLevel,
      timezone: w.profile.timezone,
    });

    await repos.goal.setActive({
      userId: w.goal.userId,
      goalType: w.goal.goalType,
      rateKgPerWeek: Math.abs(w.goal.rateKgPerWeek),
      startDate: isoDate(w.goal.startDate),
      proteinGTarget: w.goal.proteinGTarget,
      carbsGTarget: w.goal.carbsGTarget,
      fatGTarget: w.goal.fatGTarget,
    });

    await repos.weight.log({
      userId: w.weight.userId,
      date: isoDate(w.weight.date),
      weightKg: w.weight.weightKg,
      note: w.weight.note,
    });

    if (w.bodyMeasurement) {
      await repos.bodyMeasurement.log({
        userId: w.bodyMeasurement.userId,
        date: isoDate(w.bodyMeasurement.date),
        neckCm: w.bodyMeasurement.neckCm,
        waistCm: w.bodyMeasurement.waistCm,
        hipCm: w.bodyMeasurement.hipCm,
        weightKg: w.bodyMeasurement.weightKg,
        bodyFatPct: w.bodyMeasurement.bodyFatPct,
      });
    }

    await saveReminderPrefs(assessment.reminders);
    await get().hydrate(userId);
  },

  logWeight: async (weightKg, date) => {
    const { userId, timezone } = get();
    if (!userId) throw new Error("Not signed in");
    await repos.weight.log({ userId, date: isoDate(date ?? localToday(timezone)), weightKg });
    await get().hydrate(userId);
  },

  logIntake: async (calories, date) => {
    const { userId, timezone } = get();
    if (!userId) throw new Error("Not signed in");
    await repos.meal.quickAdd({
      userId,
      date: isoDate(date ?? localToday(timezone)),
      name: "Quick Add",
      kcal: calories,
    });
    await get().hydrate(userId);
  },

  logActivity: async ({ activityType, metValue, minutes, date }) => {
    const { userId, timezone, weights } = get();
    if (!userId) throw new Error("Not signed in");
    const trend = latestTrendWeight(weights);
    const caloriesActive = trend
      ? Math.max(0, (metValue - 1) * trend * (minutes / 60))
      : 0;
    await repos.activity.log({
      userId,
      date: isoDate(date ?? localToday(timezone)),
      activityType,
      metValue,
      durationMin: minutes,
      caloriesActive,
    });
    await get().hydrate(userId);
  },

  logComposition: async (input) => {
    const { userId, timezone } = get();
    if (!userId) throw new Error("Not signed in");
    await repos.bodyMeasurement.log({
      userId,
      date: isoDate(input.date ?? localToday(timezone)),
      neckCm: input.neckCm ?? null,
      waistCm: input.waistCm ?? null,
      hipCm: input.hipCm ?? null,
      weightKg: input.weightKg ?? null,
      bodyFatPct: input.bodyFatPct ?? null,
      note: input.note ?? null,
    });
    await get().hydrate(userId);
  },

  addProgressPhoto: async (input) => {
    const { userId, timezone } = get();
    if (!userId) throw new Error("Not signed in");
    await repos.progressPhoto.add({
      userId,
      date: isoDate(input.date ?? localToday(timezone)),
      body: input.body,
      ext: input.ext,
      contentType: input.contentType,
      note: input.note ?? null,
    });
    await get().hydrate(userId);
  },

  deleteMeal: async (mealId) => {
    const userId = get().userId;
    if (!userId) throw new Error("Not signed in");
    await repos.meal.deleteMeal(mealId);
    await get().hydrate(userId);
  },

  runWeeklyCheckin: async (weekStart, weekEnd, opts = {}) => {
    const s = get();
    if (!s.userId || !s.profile) return null;
    const result = computeWeeklyTdee(isoDate(weekStart), isoDate(weekEnd), s.intake, s.weights);
    const prior = s.tdee ?? seedTdee(s.profile, latestTrendWeight(s.weights)!, s.activityLevel, s.composition);
    const update = updateTdeePosterior(prior, result);
    set({ lastCheckin: result });

    if (opts.accept) {
      await repos.engineState.upsertWeek({
        userId: s.userId,
        weekStart: isoDate(weekStart),
        tdeePrior: prior,
        tdeeWeek: result.tdeeWeek,
        tdeePosterior: update.posterior,
        alpha: alphaForDaysWithBoth(result.daysWithBoth),
        completeness: result.completeness,
        avgIntake: result.avgIntake,
        deltaWeightKg: result.deltaWeightKg,
        accepted: true,
      });
    }
    return result;
  },

  /**
   * Snapshots every owned table as a single JSON document. The caller
   * decides how to deliver it (Share sheet, file write, etc.).
   */
  exportData: async () => {
    const { userId, timezone } = get();
    if (!userId) throw new Error("Not signed in");
    const since = isoDate("1970-01-01");
    const [account, goal, weights, intake, activity, bodyMeasurements, progressPhotos] = await Promise.all([
      repos.profile.getAccount(userId),
      repos.goal.getActive(userId),
      repos.weight.listSince(userId, since),
      repos.intake.listSince(userId, since),
      repos.activity.listSince(userId, since),
      repos.bodyMeasurement.listSince(userId, since),
      repos.progressPhoto.list(userId),
    ]);
    // Last 365 days of meals as a flat list. Per-day detail is the
    // expensive bit, but a year is well under what export sheets handle.
    const todayLocal = localToday(timezone);
    const yearAgo = new Date(`${todayLocal}T00:00:00Z`);
    yearAgo.setUTCDate(yearAgo.getUTCDate() - 365);
    const meals: MealSummary[] = [];
    const cursor = new Date(yearAgo);
    while (cursor.toISOString().slice(0, 10) <= todayLocal) {
      const date = cursor.toISOString().slice(0, 10);
      const dayMeals = await repos.meal.listForDate(userId, isoDate(date));
      meals.push(...dayMeals);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      account,
      goal,
      weights,
      intake,
      activity,
      bodyMeasurements,
      progressPhotos,
      meals,
    }, null, 2);
  },

  deleteAccount: async () => {
    await repos.profile.deleteSelf();
    await supabase.auth.signOut();
    get().reset();
  },
}));

// ---------- selectors ----------------------------------------------------

export const selectDailyTarget = (s: EngineState): KcalDay | null => {
  if (!s.tdee) return null;
  return dailyTargetFromTdee(s.tdee, { kgPerWeek: s.goalKgPerWeek });
};

export const selectTodayIntake = (s: EngineState): number => {
  const t = localToday(s.timezone);
  return s.intake.filter((i) => i.date === t).reduce((sum, i) => sum + i.calories, 0);
};

export const selectTodayActiveCalories = (s: EngineState): number => {
  const t = localToday(s.timezone);
  const trend = latestTrendWeight(s.weights);
  if (!trend) return 0;
  const blocks = s.activity.filter((a) => a.date === t);
  return totalActiveCalories(trend, blocks);
};

export const selectBmr = (s: EngineState): number | null => {
  if (!s.profile) return null;
  const trend = latestTrendWeight(s.weights);
  if (!trend) return null;
  // Katch–McArdle when a measured composition exists, else Mifflin–St Jeor.
  return restingEnergy(s.profile, trend, s.composition);
};

/** Body-fat fraction (0..1) and lean mass for the Command readout, or null. */
export const selectComposition = (s: EngineState): Composition | null => s.composition;

/**
 * Today's macro totals from the loaded meals. Returns {0,0,0} when no
 * meals exist for today so callers can show a "0 / target" progress
 * UI without nullable plumbing.
 */
export const selectTodayMacros = (s: EngineState): { proteinG: number; carbsG: number; fatG: number } => {
  let p = 0, c = 0, f = 0;
  for (const m of s.todayMeals) {
    for (const it of m.items) {
      p += it.proteinG ?? 0;
      c += it.carbsG ?? 0;
      f += it.fatG ?? 0;
    }
  }
  return { proteinG: p, carbsG: c, fatG: f };
};

export const selectWeeklyTargets = (s: EngineState): readonly KcalDay[] | null => {
  const avg = selectDailyTarget(s);
  if (avg === null) return null;
  return distributeWeeklyTarget(avg, [true, false, true, false, true, false, false]);
};

/**
 * Calculates days remaining until the next Bayesian update or high-conviction
 * threshold.
 */
export const selectConvergenceStatus = (s: EngineState): {
  daysRemaining: number;
  currentAlpha: number;
  nextAlpha: number;
  isConverged: boolean;
} | null => {
  if (!s.userId || !s.profile || s.weights.length === 0) return null;

  const today = localDateInTimezone(s.timezone);
  const start = new Date(`${today}T00:00:00Z`);
  const day = start.getUTCDay();
  // Find the most recent Monday
  const delta = day === 0 ? 6 : day - 1;
  start.setUTCDate(start.getUTCDate() - delta);
  const weekStart = start.toISOString().slice(0, 10);

  const intakeInWeek = s.intake.filter((i) => i.date >= weekStart && i.date <= today);
  const weightsInWeek = s.weights.filter((w) => w.date >= weekStart && w.date <= today);

  const intakeDates = new Set(intakeInWeek.map((i) => i.date));
  const weightDates = new Set(weightsInWeek.map((w) => w.date));
  let daysWithBoth = 0;
  for (const date of intakeDates) if (weightDates.has(date)) daysWithBoth++;

  const currentAlpha = alphaForDaysWithBoth(daysWithBoth);
  const isConverged = currentAlpha >= 0.6;

  let daysRemaining = 0;
  let nextAlpha = currentAlpha;

  if (daysWithBoth < 3) {
    daysRemaining = 3 - daysWithBoth;
    nextAlpha = unit(0.4);
  } else if (daysWithBoth < 5) {
    daysRemaining = 5 - daysWithBoth;
    nextAlpha = unit(0.6);
  }

  return { daysRemaining, currentAlpha, nextAlpha, isConverged };
};

/**
 * Pre-built trajectory verdict (regression + classification + expected
 * rate). Returns null when there's too little data. Computed off the
 * already-hydrated store, so calling this is cheap.
 */
export const selectTrajectory = (s: EngineState) => {
  if (s.weights.length < 3) return null;
  return fullTrajectory(s.weights, {
    windowDays: 14,
    ewmaAlpha: 0.1,
    intake: s.intake,
    ...(s.tdee != null ? { tdee: s.tdee } : {}),
    ...(s.goalKgPerWeek !== 0 ? { goalRatePerWeek: s.goalKgPerWeek } : {}),
  });
};
