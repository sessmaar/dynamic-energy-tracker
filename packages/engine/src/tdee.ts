import {
  type IntakeEntry, type IsoDate, type KcalDay, type Unit, type WeightEntry,
  KCAL_PER_KG_BODY_MASS, kcalDay, unit,
} from "./types";
import { latestTrendWeight } from "./trendWeight";

/**
 * One week's worth of inference. `weekStart` is the Monday of the period
 * the engine reasoned over; `daysWithBoth` counts days that had *both*
 * an intake log and a weight entry — the metric the Bayesian step uses
 * to decide how much to trust this week.
 */
export interface WeeklyTdeeResult {
  readonly weekStart: IsoDate;
  readonly tdeeWeek: KcalDay;
  readonly avgIntake: KcalDay;
  readonly deltaWeightKg: number;
  readonly daysWithBoth: number;
  readonly completeness: Unit;
}

const indexBy = <T extends { readonly date: IsoDate }>(rows: readonly T[]): Map<IsoDate, T> => {
  const m = new Map<IsoDate, T>();
  for (const r of rows) m.set(r.date, r);
  return m;
};

/**
 * Average daily TDEE inferred from energy balance over `[start, end]`:
 *
 *   TDEE ≈ (Σ intake − k · Δweight) / n
 *
 * where `Δweight` is the *signed* trend-weight change (start → end, so
 * negative when losing) and `k = 7700 kcal/kg`. The minus sign follows
 * from energy balance: `intake − TDEE = k·Δweight`, so a drop in weight
 * (Δw < 0) implies TDEE > intake. The PRD wrote `+ k·Δw`, which only
 * works if Δw is redefined as *mass burned*; we keep Δw as the literal
 * trend delta and put the sign in the formula.
 *
 * The engine averages across the full window length `n` regardless of
 * how many days had data, so a week with missing days reads as a
 * lower-conviction estimate via `completeness`, not as an inflated TDEE.
 */
export const computeWeeklyTdee = (
  weekStart: IsoDate,
  weekEnd: IsoDate,
  intake: readonly IntakeEntry[],
  weights: readonly WeightEntry[],
  ewmaAlpha = 0.1,
): WeeklyTdeeResult => {
  if (weekEnd < weekStart) throw new RangeError(`weekEnd ${weekEnd} precedes weekStart ${weekStart}`);

  const n = daysBetweenInclusive(weekStart, weekEnd);

  const intakeInWindow = intake.filter((i) => i.date >= weekStart && i.date <= weekEnd);
  const weightsInWindow = weights.filter((w) => w.date >= weekStart && w.date <= weekEnd);

  const totalIntake = intakeInWindow.reduce((s, e) => s + e.calories, 0);
  const avgIntake = kcalDay(intakeInWindow.length === 0 ? 0 : totalIntake / intakeInWindow.length);

  // Δweight uses the trend (EWMA) of all available weights up to and
  // including each anchor day. Falling back to raw weights would let a
  // single noisy reading swing TDEE by hundreds of kcal.
  const weightsUpToStart = weights.filter((w) => w.date <= weekStart);
  const weightsUpToEnd = weights.filter((w) => w.date <= weekEnd);
  const startTrend = latestTrendWeight(weightsUpToStart, ewmaAlpha);
  const endTrend = latestTrendWeight(weightsUpToEnd, ewmaAlpha);
  const deltaWeightKg = startTrend !== null && endTrend !== null ? endTrend - startTrend : 0;

  const tdeeWeek = kcalDay((totalIntake - KCAL_PER_KG_BODY_MASS * deltaWeightKg) / n);

  const intakeByDate = indexBy(intakeInWindow);
  const weightByDate = indexBy(weightsInWindow);
  let daysWithBoth = 0;
  for (const date of intakeByDate.keys()) if (weightByDate.has(date)) daysWithBoth++;

  return {
    weekStart,
    tdeeWeek,
    avgIntake,
    deltaWeightKg,
    daysWithBoth,
    completeness: unit(Math.min(daysWithBoth / n, 1)),
  };
};

/**
 * Bayesian-style posterior on TDEE.
 *
 *   posterior = α · week + (1 - α) · prior
 *
 * `alphaForCompleteness` maps `daysWithBoth` to the α schedule from the
 * PRD (≥5 → 0.6, 3–4 → 0.4, <3 → 0 i.e. skip the update).
 */
export const alphaForDaysWithBoth = (days: number): Unit => {
  if (days >= 5) return unit(0.6);
  if (days >= 3) return unit(0.4);
  return unit(0);
};

export interface BayesianUpdateResult {
  readonly posterior: KcalDay;
  readonly alpha: Unit;
  /** True when the week had enough data to actually shift the prior. */
  readonly updated: boolean;
}

export const updateTdeePosterior = (
  prior: KcalDay,
  week: WeeklyTdeeResult,
): BayesianUpdateResult => {
  const alpha = alphaForDaysWithBoth(week.daysWithBoth);
  if (alpha === 0) return { posterior: prior, alpha, updated: false };
  const posterior = kcalDay(alpha * week.tdeeWeek + (1 - alpha) * prior);
  return { posterior, alpha, updated: true };
};

// --- date helpers ---------------------------------------------------------

const MS_PER_DAY = 86_400_000;

export const daysBetweenInclusive = (start: IsoDate, end: IsoDate): number => {
  const s = Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10));
  const e = Date.UTC(+end.slice(0, 4),   +end.slice(5, 7)   - 1, +end.slice(8, 10));
  return Math.round((e - s) / MS_PER_DAY) + 1;
};
