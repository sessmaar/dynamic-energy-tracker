import {
  type ActivityBlock, type Kcal, type Kg, type Met,
  kcal, met, minutesToHours,
} from "./types";

/**
 * Activity catalog. Keys are stable identifiers used by the UI logger;
 * values are MET multiples from the 2011 Compendium (rounded to one
 * decimal so the catalog stays auditable in code review).
 *
 * Add entries here rather than letting the UI pass raw numbers — keeping
 * the mapping in one place is what guarantees consistent rounding across
 * iOS, web, and any future wearable importer.
 */
export const ACTIVITY_CATALOG = {
  sit:           1.3,
  stand:         1.8,
  walk_slow:     2.5,
  walk_brisk:    3.5,
  treadmill_3:   3.0,
  hike:          5.5,
  run_easy:      8.0,
  run_tempo:    10.0,
  run_hard:     12.5,
  cycle_easy:    6.0,
  cycle_hard:   10.0,
  lift_light:    3.5,
  lift_heavy:    6.0,
  hiit:          8.0,
  swim:          7.0,
} as const satisfies Record<string, number>;

export type ActivityKey = keyof typeof ACTIVITY_CATALOG;

export const metFor = (key: ActivityKey): Met => met(ACTIVITY_CATALOG[key]);

/**
 * Active-only calories: `(MET - 1) * W * t_hours`. We subtract the
 * resting 1 MET because BMR already accounts for it; folding it back in
 * here would double-count.
 *
 * MET values below 1 (which would imply *negative* active energy) are
 * clamped to 0 rather than returning a negative number — sitting can't
 * actively burn negative calories.
 */
export const activeCalories = (
  weight: Kg,
  metValue: Met,
  durationMinutes: number,
): Kcal => {
  const hours = minutesToHours(durationMinutes as never);
  const above = Math.max(metValue - 1, 0);
  return kcal(above * weight * hours);
};

/** Sum active calories for a list of blocks at a fixed body weight. */
export const totalActiveCalories = (weight: Kg, blocks: readonly ActivityBlock[]): Kcal => {
  let total = 0;
  for (const b of blocks) total += activeCalories(weight, b.met, b.durationMinutes);
  return kcal(total);
};
