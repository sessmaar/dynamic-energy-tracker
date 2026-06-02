/**
 * Glycogen + water mass distortion on the scale.
 *
 * Each gram of muscle glycogen binds ~3 g of water (Olsson & Saltin
 * 1970; Bergström 1972 — values 2.4–4.0 g across the literature,
 * 2.7 is the conservative midpoint we use). A high-carb day fills
 * glycogen stores; a low-carb day depletes them. Daily fluctuations of
 * 1–2 kg of "weight" can be entirely water + glycogen with zero change
 * in body composition.
 *
 * Sodium does the same thing via extracellular water (~50 mL per gram
 * sodium above baseline) but we don't surface that yet — most users
 * don't log sodium.
 *
 * This module is intentionally conservative. It reports an *estimated*
 * water mass attributable to a high-carb day — not a corrected weight
 * value. Users see "today's reading likely includes ~1.1 kg of carb-
 * water from yesterday" and decide for themselves how to interpret.
 */

export const GRAMS_WATER_PER_GRAM_GLYCOGEN = 2.7;

/**
 * Carb-water mass attributable to a single day's intake, in kg.
 * Counts grams *above* a moving baseline of recent intake — meaningful
 * deviation, not absolute carb load.
 */
export const carbWaterMassKg = (
  carbsG: number,
  baselineCarbsG: number,
): number => {
  if (!Number.isFinite(carbsG) || !Number.isFinite(baselineCarbsG)) return 0;
  const excess = Math.max(0, carbsG - baselineCarbsG);
  // Assume the excess pack ratio is ~1:1 into glycogen for surplus carb
  // days. (A high-protein day with the same kcal wouldn't move water
  // the same way — that's why we key off carbs specifically.)
  return (excess * GRAMS_WATER_PER_GRAM_GLYCOGEN) / 1000;
};

/**
 * Compute the rolling-median baseline carb intake from a series of
 * daily totals. Median (not mean) so a single huge cheat day doesn't
 * pull the baseline up and mask the noise it caused.
 */
export const medianCarbBaseline = (carbsPerDayG: readonly number[]): number => {
  const filtered = carbsPerDayG.filter((n) => Number.isFinite(n) && n >= 0);
  if (filtered.length === 0) return 0;
  const sorted = [...filtered].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
};
