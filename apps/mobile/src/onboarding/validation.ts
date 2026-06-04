import { type Assessment } from "./assessment";

export type StepId =
  | "welcome" | "aboutYou" | "bodyComp" | "activity"
  | "goal" | "diet" | "reminders" | "plan";

const isIsoDate = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d <= new Date();
};

export const isStepValid = (step: StepId, a: Assessment): boolean => {
  switch (step) {
    case "aboutYou":
      return a.heightCm > 0 && a.currentWeightKg > 0 && isIsoDate(a.dateOfBirth);
    case "bodyComp": {
      const b = a.bodyComp;
      if (b.method === "skip") return true;
      if (b.method === "direct")
        return b.directBodyFatPct != null && b.directBodyFatPct > 0 && b.directBodyFatPct < 1;
      const haveBase = b.neckCm != null && b.neckCm > 0 && b.waistCm != null && b.waistCm > 0;
      if (a.sex === "female") return haveBase && b.hipCm != null && b.hipCm > 0;
      return haveBase;
    }
    case "goal":
      return a.goalType === "maintain" || a.rateKgPerWeek > 0;
    case "diet":
      if (a.dietPattern !== "custom") return true;
      return (
        a.customProteinPerKg != null && a.customProteinPerKg > 0 &&
        a.customFatPct != null && a.customFatPct > 0 && a.customFatPct < 1
      );
    case "welcome":
    case "activity":
    case "reminders":
    case "plan":
      return true;
  }
};
