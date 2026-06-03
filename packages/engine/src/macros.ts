import { type Kcal, type Kg, kcal } from "./types";

/**
 * Per-day macro target in grams.
 */
export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Atwater factors. Protein/carbs 4 kcal/g, fat 9 kcal/g. */
export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_CARB = 4;
export const KCAL_PER_G_FAT = 9;

/**
 * Derive macro targets from:
 *   - a daily calorie target (kcal/day),
 *   - body weight (for the protein anchor),
 *   - a preference: protein in g/kg body weight + fat as % of total energy.
 *
 * If `leanMassKg` is provided in `prefs`, protein is anchored to lean
 * mass instead of total weight, typically using a higher multiplier
 * (default 2.2 g/kg lean mass vs. 2.0 g/kg total mass).
 *
 * Carbs absorb the residual energy so the three macros add up to exactly
 * the kcal target. If the chosen protein + fat exceed the kcal budget,
 * carbs clamp to 0 and the deficit lives in the protein/fat slices —
 * the caller can detect this by `carbsG === 0`.
 *
 * Defaults reflect a moderate-protein cut: 2.0 g/kg total mass or
 * 2.2 g/kg lean mass, and 25 % fat.
 */
export const computeMacroTargets = (
  dailyKcalTarget: number,
  bodyWeight: Kg,
  prefs: { proteinPerKg?: number; fatPct?: number; leanMassKg?: Kg } = {},
): MacroTargets => {
  const fatPct = prefs.fatPct ?? 0.25;
  if (fatPct < 0 || fatPct > 1) {
    throw new RangeError(`fatPct must be in [0,1], got ${fatPct}`);
  }

  // Anchor protein to lean mass if we have it, else total mass.
  const proteinG = prefs.leanMassKg
    ? Math.round((prefs.proteinPerKg ?? 2.2) * prefs.leanMassKg)
    : Math.round((prefs.proteinPerKg ?? 2.0) * bodyWeight);

  const fatKcal = dailyKcalTarget * fatPct;
  const fatG = Math.round(fatKcal / KCAL_PER_G_FAT);
  const proteinKcal = proteinG * KCAL_PER_G_PROTEIN;
  const carbsKcal = Math.max(0, dailyKcalTarget - proteinKcal - fatKcal);
  const carbsG = Math.round(carbsKcal / KCAL_PER_G_CARB);
  return { proteinG, carbsG, fatG };
};

/** Inverse: roll macro grams into kcal. Useful for "did the targets sum right?". */
export const macrosToKcal = (m: MacroTargets): Kcal =>
  kcal(m.proteinG * KCAL_PER_G_PROTEIN + m.carbsG * KCAL_PER_G_CARB + m.fatG * KCAL_PER_G_FAT);
