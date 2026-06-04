import { type Assessment } from "./assessment";
import { computeStartingPlan, signedRate } from "./plan";
import { clampGoalToSafety } from "@dynamic-energy/engine";

export interface OnboardingWrite {
  profile: {
    userId: string;
    sex: "male" | "female";
    dateOfBirth: string;
    heightCm: number;
    initialWeightKg: number;
    activityLevel: Assessment["activityLevel"];
    timezone: string;
  };
  goal: {
    userId: string;
    goalType: "cut" | "maintain" | "gain";
    rateKgPerWeek: number; // signed, safety-clamped
    startDate: string;
    proteinGTarget: number;
    carbsGTarget: number;
    fatGTarget: number;
  };
  weight: { userId: string; date: string; weightKg: number; note: string };
  bodyMeasurement:
    | null
    | {
        userId: string;
        date: string;
        neckCm: number | null;
        waistCm: number | null;
        hipCm: number | null;
        weightKg: number;
        bodyFatPct: number | null;
      };
}

export const buildOnboardingWrite = (
  a: Assessment,
  userId: string,
  timezone: string,
  today: string,
): OnboardingWrite => {
  const plan = computeStartingPlan(a, today);
  const safeRate = clampGoalToSafety(signedRate(a), a.currentWeightKg);

  const bodyMeasurement =
    a.bodyComp.method === "skip"
      ? null
      : {
          userId,
          date: today,
          neckCm: a.bodyComp.neckCm,
          waistCm: a.bodyComp.waistCm,
          hipCm: a.bodyComp.hipCm,
          weightKg: a.currentWeightKg,
          bodyFatPct: a.bodyComp.method === "direct" ? a.bodyComp.directBodyFatPct : null,
        };

  return {
    profile: {
      userId,
      sex: a.sex,
      dateOfBirth: a.dateOfBirth,
      heightCm: a.heightCm,
      initialWeightKg: a.currentWeightKg,
      activityLevel: a.activityLevel,
      timezone,
    },
    goal: {
      userId,
      goalType: a.goalType,
      rateKgPerWeek: safeRate,
      startDate: today,
      proteinGTarget: plan.macros.proteinG,
      carbsGTarget: plan.macros.carbsG,
      fatGTarget: plan.macros.fatG,
    },
    weight: { userId, date: today, weightKg: a.currentWeightKg, note: "Initial weight (onboarding)" },
    bodyMeasurement,
  };
};
