import {
  type ActivityBlock, type IntakeEntry, type IsoDate, type KcalDay, type Sex,
  type UserProfile, type WeeklyTdeeResult, type WeightEntry,
  alphaForDaysWithBoth, computeWeeklyTdee, dailyTargetFromTdee,
  distributeWeeklyTarget, fullTrajectory, isoDate, kcalDay, latestTrendWeight,
  localDateInTimezone, mifflinStJeor, totalActiveCalories, updateTdeePosterior,
} from "@dynamic-energy/engine";
import type { MealSummary, RecipeSummary } from "@dynamic-energy/data";
import { create } from "zustand";
import { repos, supabase } from "@/lib/supabase";

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
  goalKgPerWeek: number;

  weights: WeightEntry[];
  intake: IntakeEntry[];
  activity: ActivityBlock[];
  todayMeals: MealSummary[];
  recipes: RecipeSummary[];
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
    goalKgPerWeek: number;
    timezone?: string;
  }) => Promise<void>;

  logWeight: (weightKg: number, date?: string) => Promise<void>;
  logIntake: (calories: number, date?: string) => Promise<void>;
  logActivity: (input: {
    activityType: string;
    metValue: number;
    minutes: number;
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
 * Re-derive TDEE from the current store snapshot. Walks each weekly
 * window from oldest → newest applying the Bayesian update; falls back
 * to BMR × 1.4 when there are no completed weeks (cold start).
 */
const deriveTdee = (s: Pick<EngineState, "profile" | "weights" | "intake" | "timezone">): KcalDay | null => {
  if (!s.profile || s.weights.length === 0) return null;
  const trend = latestTrendWeight(s.weights);
  if (!trend) return null;

  const seed = kcalDay(mifflinStJeor(s.profile, trend) * 1.4);

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
  goalKgPerWeek: 0,
  weights: [],
  intake: [],
  activity: [],
  todayMeals: [],
  recipes: [],
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
      const [goalWithMacros, weights, intake, activity, todayMeals, recipes] = await Promise.all([
        repos.goal.getActiveWithMacros(userId),
        repos.weight.listSince(userId, since),
        repos.intake.listSince(userId, since),
        repos.activity.listSince(userId, since),
        repos.meal.listForDate(userId, todayIso),
        repos.recipe.list(userId),
      ]);
      const goal = goalWithMacros?.weekly ?? null;
      const snapshot = {
        profile: account?.profile ?? null,
        weights,
        intake,
        timezone: tz,
      };
      set({
        profile: account?.profile ?? null,
        dateOfBirth: account?.dateOfBirth ?? null,
        initialWeightKg: account?.initialWeightKg ?? null,
        timezone: tz,
        goalKgPerWeek: goal?.kgPerWeek ?? 0,
        macroTargets: {
          proteinG: goalWithMacros?.proteinG ?? null,
          carbsG: goalWithMacros?.carbsG ?? null,
          fatG: goalWithMacros?.fatG ?? null,
        },
        weights, intake, activity, todayMeals, recipes,
        tdee: deriveTdee(snapshot),
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  reset: () => set({
    userId: null, profile: null, dateOfBirth: null, initialWeightKg: null,
    timezone: DEFAULT_TZ, goalKgPerWeek: 0,
    macroTargets: { proteinG: null, carbsG: null, fatG: null },
    weights: [], intake: [], activity: [], todayMeals: [], recipes: [],
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
    const prior = s.tdee ?? kcalDay(mifflinStJeor(s.profile, latestTrendWeight(s.weights)!) * 1.4);
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
    const [account, goal, weights, intake, activity] = await Promise.all([
      repos.profile.getAccount(userId),
      repos.goal.getActive(userId),
      repos.weight.listSince(userId, since),
      repos.intake.listSince(userId, since),
      repos.activity.listSince(userId, since),
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
  return mifflinStJeor(s.profile, trend);
};

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
