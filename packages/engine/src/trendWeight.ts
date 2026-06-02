import { type Kg, type WeightEntry, kg } from "./types";

/**
 * Exponentially-weighted moving average over chronologically-ordered
 * weight entries. `alpha` controls smoothing — lower is smoother, higher
 * is more responsive. Default 0.10 ≈ ~10-day half-life, which matches
 * MacroFactor-style trend behavior and the BMR contract in DESIGN.md.
 *
 * Returns one trend value per input day. Gaps between dates are *not*
 * interpolated here; the caller decides whether to drop or fill. This
 * keeps the function pure and the responsibility explicit.
 */
export const ewmaTrend = (
  entries: readonly WeightEntry[],
  alpha = 0.1,
): readonly { readonly date: string; readonly trend: Kg }[] => {
  if (alpha <= 0 || alpha > 1) throw new RangeError(`alpha must be in (0,1], got ${alpha}`);
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out: { date: string; trend: Kg }[] = [];
  let trend = sorted[0]!.weight;
  for (const e of sorted) {
    trend = kg(alpha * e.weight + (1 - alpha) * trend);
    out.push({ date: e.date, trend });
  }
  return out;
};

/** Most recent trend value, or null if there are no entries. */
export const latestTrendWeight = (entries: readonly WeightEntry[], alpha = 0.1): Kg | null => {
  const series = ewmaTrend(entries, alpha);
  return series.length === 0 ? null : series[series.length - 1]!.trend;
};
