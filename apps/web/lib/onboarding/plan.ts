import {
  type Composition, type MacroTargets,
  cm, clampedDailyTargetFromTdee, computeMacroTargets, kg,
  resolveComposition, seedTdee, unit, years,
} from "@dynamic-energy/engine";
import { type Assessment } from "./assessment";

/**
 * Whole-years age between two calendar dates (both ISO YYYY-MM-DD).
 * Mirrors the engine's ageFromDob algorithm but works from an explicit
 * "today" date rather than a timezone, which is what this module has.
 */
const ageFromDobOnDate = (dob: string, today: string): number => {
  const [by, bm, bd] = dob.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return Math.max(0, age);
};

export interface StartingPlan {
  tdee: number;
  dailyCalories: number;
  macros: MacroTargets;
  clamped: boolean;
  /** signed kg/week actually used after safety clamp. */
  effectiveRateKgPerWeek: number;
  usedComposition: boolean;
  leanMassKg: number | null;
}

/** Signed weekly rate from the goal direction. */
export const signedRate = (a: Assessment): number => {
  const mag = Math.abs(a.rateKgPerWeek);
  if (a.goalType === "maintain") return 0;
  return a.goalType === "cut" ? -mag : mag;
};

const macroPrefs = (a: Assessment, comp: Composition | null) => {
  const leanMassKg = comp ? (comp.leanMassKg as number) : undefined;
  switch (a.dietPattern) {
    case "high_protein":
      return { proteinPerKg: leanMassKg ? 2.6 : 2.4, fatPct: 0.25, leanMassKg: leanMassKg ? kg(leanMassKg) : undefined };
    case "lower_carb":
      return { proteinPerKg: leanMassKg ? 2.4 : 2.2, fatPct: 0.40, leanMassKg: leanMassKg ? kg(leanMassKg) : undefined };
    case "custom":
      return {
        proteinPerKg: a.customProteinPerKg ?? 2.0,
        fatPct: a.customFatPct ?? 0.25,
        leanMassKg: leanMassKg ? kg(leanMassKg) : undefined,
      };
    case "balanced":
    default:
      return { proteinPerKg: leanMassKg ? 2.2 : 2.0, fatPct: 0.25, leanMassKg: leanMassKg ? kg(leanMassKg) : undefined };
  }
};

/**
 * Compute the user's starting plan from their assessment. `today` is an
 * ISO date used to derive age from date of birth.
 */
export const computeStartingPlan = (a: Assessment, today: string): StartingPlan => {
  const profile = {
    sex: a.sex,
    age: years(ageFromDobOnDate(a.dateOfBirth, today)),
    heightCm: cm(a.heightCm),
  };
  const weight = kg(a.currentWeightKg);

  const comp: Composition | null = resolveComposition({
    sex: a.sex,
    heightCm: cm(a.heightCm),
    weightKg: weight,
    neckCm: a.bodyComp.neckCm != null ? cm(a.bodyComp.neckCm) : undefined,
    waistCm: a.bodyComp.waistCm != null ? cm(a.bodyComp.waistCm) : undefined,
    hipCm: a.bodyComp.hipCm != null ? cm(a.bodyComp.hipCm) : undefined,
    directBodyFatPct:
      a.bodyComp.method === "direct" && a.bodyComp.directBodyFatPct != null
        ? unit(a.bodyComp.directBodyFatPct)
        : undefined,
  });

  const tdee = seedTdee(profile, weight, a.activityLevel, comp);
  const { target, clamped, effectiveGoal } = clampedDailyTargetFromTdee(
    tdee,
    { kgPerWeek: signedRate(a) },
    a.currentWeightKg,
  );
  const macros = computeMacroTargets(target, weight, macroPrefs(a, comp));

  return {
    tdee: tdee as number,
    dailyCalories: target as number,
    macros,
    clamped,
    effectiveRateKgPerWeek: effectiveGoal,
    usedComposition: comp !== null,
    leanMassKg: comp ? (comp.leanMassKg as number) : null,
  };
};
