import { type Assessment } from "./assessment";
import { computeStartingPlan } from "./plan";
import { useLocalStore } from "../local-store";

/**
 * Apply an onboarding assessment to the local store: set profile,
 * set goal (with macro targets from the engine), seed the initial
 * weight entry. `today` is an ISO YYYY-MM-DD; `timezone` is the
 * IANA timezone the profile will live in.
 */
export const commitOnboarding = (
  a: Assessment,
  timezone: string,
  today: string,
): void => {
  const plan = computeStartingPlan(a, today);
  const s = useLocalStore.getState();

  s.setProfile({
    sex: a.sex,
    dateOfBirth: a.dateOfBirth,
    heightCm: a.heightCm,
    initialWeightKg: a.currentWeightKg,
    units: a.units,
    timezone,
    activityLevel: a.activityLevel,
  });

  s.setGoal({
    type: a.goalType,
    rateKgPerWeek: Math.abs(a.rateKgPerWeek),
    startDate: today,
    goalWeightKg: a.goalWeightKg,
    proteinG: plan.macros.proteinG,
    carbsG: plan.macros.carbsG,
    fatG: plan.macros.fatG,
  });

  s.addWeight({
    date: today,
    weightKg: a.currentWeightKg,
    note: "Initial weight (onboarding)",
  });
};
