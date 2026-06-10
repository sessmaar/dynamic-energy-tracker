import type { ActivityLevel } from "@dynamic-energy/engine";

export type UnitSystem = "metric" | "imperial";
export type Sex = "male" | "female";
export type GoalType = "cut" | "maintain" | "gain";
export type DietPattern = "balanced" | "high_protein" | "lower_carb" | "custom";
export type BodyCompMethod = "skip" | "direct" | "tape";

/** All measurements stored metric-internal (kg, cm); body-fat as a 0..1 fraction. */
export interface BodyCompState {
  method: BodyCompMethod;
  /** direct: 0..1 fraction entered by the user from a measured source. */
  directBodyFatPct: number | null;
  /** tape: cm. hip required only for female estimates. */
  neckCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
}

export interface RemindersState {
  logging: boolean;
  weighIn: boolean;
  weeklyCheckin: boolean;
  /** weigh-in cadence in days (1 = daily, 7 = weekly). */
  weighInCadenceDays: number;
}

export interface Assessment {
  units: UnitSystem;
  sex: Sex;
  /** ISO YYYY-MM-DD. */
  dateOfBirth: string;
  heightCm: number;
  currentWeightKg: number;
  bodyComp: BodyCompState;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  /** absolute kg/week magnitude the user picked (sign applied from goalType). */
  rateKgPerWeek: number;
  goalWeightKg: number | null;
  dietPattern: DietPattern;
  /** custom only: protein grams per kg bodyweight. */
  customProteinPerKg: number | null;
  /** custom only: fat as a 0..1 fraction of energy. */
  customFatPct: number | null;
  dietaryTags: string[];
  reminders: RemindersState;
}

export const initialAssessment: Assessment = {
  units: "metric",
  sex: "male",
  dateOfBirth: "1995-01-01",
  heightCm: 180,
  currentWeightKg: 80,
  bodyComp: { method: "skip", directBodyFatPct: null, neckCm: null, waistCm: null, hipCm: null },
  activityLevel: "moderate",
  goalType: "cut",
  rateKgPerWeek: 0.5,
  goalWeightKg: null,
  dietPattern: "balanced",
  customProteinPerKg: null,
  customFatPct: null,
  dietaryTags: [],
  reminders: { logging: false, weighIn: false, weeklyCheckin: false, weighInCadenceDays: 1 },
};

export type AssessmentAction =
  | { type: "set"; patch: Partial<Assessment> }
  | { type: "setBodyComp"; patch: Partial<BodyCompState> }
  | { type: "setReminders"; patch: Partial<RemindersState> };

export const assessmentReducer = (state: Assessment, action: AssessmentAction): Assessment => {
  switch (action.type) {
    case "set":
      return { ...state, ...action.patch };
    case "setBodyComp":
      return { ...state, bodyComp: { ...state.bodyComp, ...action.patch } };
    case "setReminders":
      return { ...state, reminders: { ...state.reminders, ...action.patch } };
  }
};
