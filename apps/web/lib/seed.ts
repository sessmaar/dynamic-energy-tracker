import {
  type IntakeEntry, type WeightEntry,
  isoDate, kcal, kg,
} from "@dynamic-energy/engine";

/**
 * Deterministic synthetic data so the console renders identically on
 * every request. Models a 12-week cut: a 79 kg operator targeting
 * −0.4 kg/week at ~2,250 kcal intake on a ~2,700 kcal TDEE, with
 * realistic day-to-day noise on both axes.
 *
 * We use a Mulberry32 PRNG seeded with a constant so server and client
 * see the same series (no hydration mismatch) and so the demo doesn't
 * change between page loads.
 */

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const toIso = (d: Date): string => d.toISOString().slice(0, 10);

const addDays = (d: Date, n: number): Date => {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
};

export interface SeededDataset {
  readonly today: string;
  readonly startDate: string;
  readonly weights: WeightEntry[];
  readonly intake: IntakeEntry[];
  /** Bookkeeping the console UI uses to label segments. */
  readonly profile: {
    readonly startWeightKg: number;
    readonly goalKgPerWeek: number;
    readonly trueTdee: number;
  };
}

export const seedDataset = (
  weeks = 12,
  // Pinned date so SSR + client agree without a `useEffect` dance.
  anchor = new Date("2026-06-01T00:00:00Z"),
): SeededDataset => {
  const rng = mulberry32(0xDE71); // "DE 71" — Dynamic Energy 71
  const days = weeks * 7;
  const startDate = addDays(anchor, -(days - 1));

  const trueTdee = 2700;
  const startWeight = 79.0;
  const goalKgPerWeek = -0.4;
  const kcalPerKg = 7700;

  const weights: WeightEntry[] = [];
  const intake: IntakeEntry[] = [];

  // We integrate a simple physical model: each day, real ΔW = (intake − TDEE)/k.
  // Logged intake jitters around target; weight jitters around the trend.
  let trueWeight = startWeight;
  // Target each day: TDEE + (goal_kg_per_week · 7700) / 7
  const dailyEnergyDelta = (goalKgPerWeek * kcalPerKg) / 7;
  const baseIntake = trueTdee + dailyEnergyDelta;

  for (let i = 0; i < days; i++) {
    const day = addDays(startDate, i);
    const date = isoDate(toIso(day));

    // Intake noise ~ N(0, 180²) plus a weekend bump.
    const dow = day.getUTCDay();
    const weekendBump = dow === 0 || dow === 6 ? 250 : 0;
    const noise = (rng() - 0.5) * 360;
    const todayIntake = baseIntake + noise + weekendBump;
    intake.push({ date, calories: kcal(Math.round(todayIntake)) });

    // Real energy balance moves the trend; scale jitter sits on top.
    trueWeight += (todayIntake - trueTdee) / kcalPerKg;
    const scaleJitter = (rng() - 0.5) * 0.6;
    weights.push({ date, weight: kg(Number((trueWeight + scaleJitter).toFixed(2))) });
  }

  return {
    today: toIso(anchor),
    startDate: toIso(startDate),
    weights,
    intake,
    profile: { startWeightKg: startWeight, goalKgPerWeek, trueTdee },
  };
};

/** Weekly windows (Monday → Sunday) covering the dataset, oldest first. */
export const weeklyWindows = (startIso: string, endIso: string): { start: string; end: string }[] => {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  // Snap start forward to the next Monday.
  const day = start.getUTCDay();
  const delta = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const firstMonday = addDays(start, delta);
  const out: { start: string; end: string }[] = [];
  let cursor = firstMonday;
  while (addDays(cursor, 6) <= end) {
    out.push({ start: toIso(cursor), end: toIso(addDays(cursor, 6)) });
    cursor = addDays(cursor, 7);
  }
  return out;
};
