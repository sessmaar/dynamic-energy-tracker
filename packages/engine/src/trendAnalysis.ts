import {
  type IntakeEntry, type Kcal, type Kg, type WeightEntry,
  KCAL_PER_KG_BODY_MASS,
} from "./types";
import { ewmaTrend } from "./trendWeight";
import { carbWaterMassKg, medianCarbBaseline } from "./waterAdjust";

/**
 * Trajectory analysis — the "am I actually losing weight?" question,
 * answered scientifically rather than by squinting at noisy daily
 * scale readings.
 *
 * Pipeline (matches MacroFactor / Hall et al. / Heymsfield body-weight
 * dynamics literature):
 *
 *   1. Smooth raw weights with EWMA (existing trendWeight module).
 *   2. Fit ordinary least squares slope on the trend over a rolling
 *      window (default 14 days — long enough to escape glycogen/water
 *      noise, short enough to stay current).
 *   3. Compute standard error of the slope from residuals, then a
 *      95 % CI using a normal approximation (n is small but t-table
 *      adds little; ±1.96 is good enough and avoids importing tables).
 *   4. Classify: if the CI doesn't cross zero AND |rate| exceeds a
 *      maintenance threshold, the trajectory is decisive. Otherwise
 *      maintaining (if both magnitude and CI agree) or inconclusive.
 *
 * The "expected rate" is the engine's prediction from logged intake vs.
 * inferred TDEE: (avgIntake − TDEE) · 7 / 6200. Comparing actual to
 * expected lets the UI say things like "you're losing 0.42 kg/wk —
 * matches your target".
 */

export interface TrendAnalysis {
  /** Signed rate in kg/week (negative = losing). */
  ratePerWeek: number;
  /** Standard error of the slope, kg/week. */
  ratePerWeekSE: number;
  /** 95 % confidence interval on the rate. */
  ratePerWeekCI: { lo: number; hi: number };
  /** Days of data actually used in the regression. */
  windowDays: number;
  /** Residual SD around the regression line, kg — how well a line fits. */
  residualSDKg: number;
  /** Day-to-day SD of *raw* weights — the visible scale noise floor. */
  rawDailySDKg: number;
  /** Linear-fit y-intercept, in trend kg at window start. Mostly for chart overlay. */
  intercept: number;
  /** Estimated transient water mass (kg) from recent carb intake. */
  transientWaterKg: number;
}

const MS_PER_DAY = 86_400_000;

/** Ordinary least squares slope + intercept. Returns null if degenerate. */
const ols = (
  pairs: readonly { x: number; y: number }[],
): { slope: number; intercept: number; residualSD: number } | null => {
  if (pairs.length < 3) return null;
  const n = pairs.length;
  let sumX = 0, sumY = 0;
  for (const p of pairs) { sumX += p.x; sumY += p.y; }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let sxx = 0, sxy = 0;
  for (const p of pairs) {
    const dx = p.x - meanX;
    sxx += dx * dx;
    sxy += dx * (p.y - meanY);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  let ss = 0;
  for (const p of pairs) {
    const fit = intercept + slope * p.x;
    const resid = p.y - fit;
    ss += resid * resid;
  }
  // n-2 dof for residual variance in simple linear regression.
  const residualSD = Math.sqrt(ss / Math.max(n - 2, 1));
  return { slope, intercept, residualSD };
};

/**
 * Weighted Least Squares (WLS) for time series.
 * Applies exponential decay weights to recent observations.
 * Provides better recency focus while maintaining statistical integrity
 * of the standard error vs. regressing on smoothed data.
 */
const wls = (
  pairs: readonly { x: number; y: number }[],
  alpha: number,
): {
  slope: number;
  intercept: number;
  residualSD: number;
} | null => {
  const n = pairs.length;
  if (n < 2) return null;

  // Latest point has weight 1.0, weights decay backwards.
  const maxX = Math.max(...pairs.map((p) => p.x));
  const weighted = pairs.map((p) => ({
    ...p,
    w: Math.pow(1 - alpha, maxX - p.x),
  }));

  let sw = 0, swx = 0, swy = 0, swxx = 0, swxy = 0;
  for (const p of weighted) {
    sw += p.w;
    swx += p.w * p.x;
    swy += p.w * p.y;
    swxx += p.w * p.x * p.x;
    swxy += p.w * p.x * p.y;
  }

  const denom = sw * swxx - swx * swx;
  if (Math.abs(denom) < 1e-12) return null;
  const slope = (sw * swxy - swx * swy) / denom;
  const intercept = (swy - slope * swx) / sw;

  let rwss = 0;
  for (const p of weighted) {
    const err = p.y - (slope * p.x + intercept);
    rwss += p.w * err * err;
  }

  // Effective degrees of freedom for WLS is roughly Σw / max(w) - 2.
  // Using sw - 2 is a conservative approximation for uncertainty.
  return { slope, intercept, residualSD: Math.sqrt(rwss / Math.max(sw - 2, 0.1)) };
};

/**
 * Convert YYYY-MM-DD into an integer day offset from `originIso`.
 * Avoids JS Date timezone gotchas by parsing as UTC.
 */
const dayIndex = (iso: string, originIso: string): number => {
  const ms = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const o = Date.UTC(+originIso.slice(0, 4), +originIso.slice(5, 7) - 1, +originIso.slice(8, 10));
  return Math.round((ms - o) / MS_PER_DAY);
};

/**
 * Run the full analysis. Returns null if the user has fewer than ~3
 * weight points inside the window — there's no honest line to fit.
 *
 * 2025 Refinement: Switches from OLS-on-EWMA to WLS-on-Raw.
 * Regressing on pre-smoothed data underestimates standard error due to
 * artificial autocorrelation. WLS on raw weights with exponential decay
 * achieves the same "recency bias" while providing scientifically
 * valid confidence intervals.
 */
export const analyzeTrend = (
  weights: readonly WeightEntry[],
  opts: { windowDays?: number; alpha?: number; intake?: readonly IntakeEntry[] } = {},
): TrendAnalysis | null => {
  const windowDays = opts.windowDays ?? 14;
  const alpha = opts.alpha ?? 0.1;

  if (weights.length < 3) return null;
  const sorted = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1));

  // Clip raw weights to the trailing `windowDays` calendar days, using
  // the latest weight entry as "today".
  const latestDate = sorted[sorted.length - 1]!.date;
  const earliest = (() => {
    const d = new Date(`${latestDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (windowDays - 1));
    return d.toISOString().slice(0, 10);
  })();

  const rawInWindow = sorted.filter((w) => w.date >= earliest);
  if (rawInWindow.length < 3) return null;

  const origin = rawInWindow[0]!.date;
  const pairs = rawInWindow.map((w) => ({
    x: dayIndex(w.date, origin),
    y: w.weight as number,
  }));

  const fit = wls(pairs, alpha);
  if (!fit) return null;

  // In WLS, the standard error formula uses the weighted sum of squares.
  let swxx = 0;
  let sw = 0, swx = 0;
  const maxX = Math.max(...pairs.map((p) => p.x));
  for (const p of pairs) {
    const w = Math.pow(1 - alpha, maxX - p.x);
    sw += w;
    swx += w * p.x;
  }
  const weightedMeanX = swx / sw;
  for (const p of pairs) {
    const w = Math.pow(1 - alpha, maxX - p.x);
    const dx = p.x - weightedMeanX;
    swxx += w * dx * dx;
  }
  const slopeSE = fit.residualSD / Math.sqrt(swxx);

  const ratePerWeek = fit.slope * 7;
  const ratePerWeekSE = slopeSE * 7;

  // Raw daily SD for the UI noise metric.
  const rawValues = rawInWindow.map((w) => w.weight as number);
  const rawMean = rawValues.reduce((s, v) => s + v, 0) / rawValues.length;
  const rawSD = rawValues.length > 1
    ? Math.sqrt(rawValues.reduce((s, v) => s + (v - rawMean) ** 2, 0) / (rawValues.length - 1))
    : 0;

  // Transient water from carbs.
  let transientWaterKg = 0;
  if (opts.intake && opts.intake.length > 0) {
    const intakeInWindow = opts.intake.filter((i) => i.date >= earliest && i.date <= latestDate);
    const latestIntake = intakeInWindow.find((i) => i.date === latestDate);
    if (latestIntake && latestIntake.carbsG != null) {
      const carbsInWindow = intakeInWindow.map((i) => i.carbsG).filter((c): c is number => c != null);
      const baseline = medianCarbBaseline(carbsInWindow);
      transientWaterKg = carbWaterMassKg(latestIntake.carbsG, baseline);
    }
  }

  return {
    ratePerWeek,
    ratePerWeekSE,
    ratePerWeekCI: {
      lo: ratePerWeek - 1.96 * ratePerWeekSE,
      hi: ratePerWeek + 1.96 * ratePerWeekSE,
    },
    windowDays: rawInWindow.length,
    residualSDKg: fit.residualSD,
    rawDailySDKg: rawSD,
    intercept: fit.intercept,
    transientWaterKg,
  };
};

// ============================================================================
// Trajectory classification
// ============================================================================

export type Trajectory = "losing" | "gaining" | "maintaining" | "inconclusive";

export interface TrajectoryVerdict {
  status: Trajectory;
  ratePerWeek: number;
  ratePerWeekCI: { lo: number; hi: number };

  /** Expected rate from energy balance, kg/week. Optional. */
  expectedRatePerWeek?: number;
  /** Goal rate from user's active goal, kg/week. Optional. */
  goalRatePerWeek?: number;
  /** True when actual rate matches goal within tolerance. */
  onTrack?: boolean;

  /** Estimated transient water mass (kg) from recent carb intake. */
  transientWaterKg: number;

  /** Single-line UI cue. */
  cue: string;
}

export const classifyTrajectory = (
  analysis: TrendAnalysis,
  opts: {
    goalRatePerWeek?: number;
    expectedRatePerWeek?: number;
    /** Magnitude threshold for "maintaining" — kg/wk. Default 0.1. */
    maintainThreshold?: number;
    /** Tolerance for "on track" vs goal — kg/wk. Default 0.15. */
    onTrackTolerance?: number;
  } = {},
): TrajectoryVerdict => {
  const maintainThreshold = opts.maintainThreshold ?? 0.1;
  const onTrackTolerance = opts.onTrackTolerance ?? 0.15;

  const { ratePerWeek, ratePerWeekCI, transientWaterKg } = analysis;
  const ciCrossesZero = ratePerWeekCI.lo <= 0 && ratePerWeekCI.hi >= 0;
  const magnitudeBelowThreshold = Math.abs(ratePerWeek) < maintainThreshold;

  let status: Trajectory;
  if (ciCrossesZero && magnitudeBelowThreshold) {
    status = "maintaining";
  } else if (ciCrossesZero) {
    status = "inconclusive";
  } else if (ratePerWeek < 0) {
    status = "losing";
  } else {
    status = "gaining";
  }

  const onTrack = opts.goalRatePerWeek != null
    ? Math.abs(ratePerWeek - opts.goalRatePerWeek) <= onTrackTolerance
    : undefined;

  const cue = buildCue(status, ratePerWeek, ratePerWeekCI, transientWaterKg, opts.goalRatePerWeek, onTrack);

  return {
    status, ratePerWeek, ratePerWeekCI,
    transientWaterKg,
    ...(opts.expectedRatePerWeek !== undefined ? { expectedRatePerWeek: opts.expectedRatePerWeek } : {}),
    ...(opts.goalRatePerWeek !== undefined ? { goalRatePerWeek: opts.goalRatePerWeek } : {}),
    ...(onTrack !== undefined ? { onTrack } : {}),
    cue,
  };
};

const buildCue = (
  status: Trajectory,
  rate: number,
  ci: { lo: number; hi: number },
  transientWater: number,
  goal?: number,
  onTrack?: boolean,
): string => {
  const fmt = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)} kg/wk`;
  const ciStr = `±${((ci.hi - ci.lo) / 2).toFixed(2)}`;
  let base =
    status === "maintaining" ? "HOLDING · trend flat within noise"
    : status === "inconclusive" ? `INCONCLUSIVE · rate ${fmt(rate)} ${ciStr} crosses zero`
    : status === "losing" ? `LOSING ${fmt(rate)} ${ciStr}`
    : `GAINING ${fmt(rate)} ${ciStr}`;

  if (transientWater > 0.3) {
    base += ` (incl. ~${transientWater.toFixed(1)}kg water)`;
  }

  if (goal == null) return base;
  if (status === "inconclusive") return base;
  if (onTrack) return `${base} · on target`;
  const gap = rate - goal;
  return `${base} · target ${fmt(goal)} (Δ ${fmt(gap)})`;
};

// ============================================================================
// Expected rate from energy balance
// ============================================================================

/**
 * Predicted kg/week from average intake vs. inferred TDEE:
 *   expectedRate = (avgIntake − TDEE) · 7 / 7700
 *
 * Caller passes the recent intake window — typically the same window
 * used for the trend regression. Returns null when intake is sparse.
 */
export const expectedRateFromBalance = (
  intake: readonly IntakeEntry[],
  tdee: number,
  windowDays = 14,
): number | null => {
  if (intake.length === 0) return null;
  const sorted = [...intake].sort((a, b) => (a.date < b.date ? -1 : 1));
  const tailStartIdx = Math.max(0, sorted.length - windowDays);
  const window = sorted.slice(tailStartIdx);
  if (window.length < 3) return null;
  const avg = window.reduce((s, e) => s + e.calories, 0) / window.length;
  return ((avg - tdee) * 7) / KCAL_PER_KG_BODY_MASS;
};

/** Convenience: package the regression + classification in one call. */
export const fullTrajectory = (
  weights: readonly WeightEntry[],
  opts: {
    windowDays?: number;
    ewmaAlpha?: number;
    intake?: readonly IntakeEntry[];
    tdee?: number;
    goalRatePerWeek?: number;
    maintainThreshold?: number;
    onTrackTolerance?: number;
  } = {},
): { analysis: TrendAnalysis; verdict: TrajectoryVerdict } | null => {
  const analysis = analyzeTrend(weights, {
    ...(opts.windowDays !== undefined ? { windowDays: opts.windowDays } : {}),
    ...(opts.ewmaAlpha !== undefined ? { ewmaAlpha: opts.ewmaAlpha } : {}),
    intake: opts.intake,
  });
  if (!analysis) return null;
  const expectedRatePerWeek = opts.intake && opts.tdee != null
    ? expectedRateFromBalance(opts.intake, opts.tdee, opts.windowDays ?? 14)
    : null;
  const verdict = classifyTrajectory(analysis, {
    ...(opts.goalRatePerWeek !== undefined ? { goalRatePerWeek: opts.goalRatePerWeek } : {}),
    ...(expectedRatePerWeek !== null && expectedRatePerWeek !== undefined
      ? { expectedRatePerWeek }
      : {}),
    ...(opts.maintainThreshold !== undefined ? { maintainThreshold: opts.maintainThreshold } : {}),
    ...(opts.onTrackTolerance !== undefined ? { onTrackTolerance: opts.onTrackTolerance } : {}),
  });
  return { analysis, verdict };
};
