import { describe, expect, it } from "vitest";
import { computeStartingPlan } from "../plan";
import { initialAssessment, type Assessment } from "../assessment";

const base: Assessment = {
  ...initialAssessment,
  sex: "male",
  dateOfBirth: "1990-01-01",
  heightCm: 180,
  currentWeightKg: 80,
  activityLevel: "moderate",
  goalType: "cut",
  rateKgPerWeek: 0.5,
};

describe("computeStartingPlan", () => {
  it("computes a positive TDEE and a target below TDEE for a cut", () => {
    const p = computeStartingPlan(base, "2026-06-03");
    expect(p.tdee).toBeGreaterThan(1500);
    expect(p.dailyCalories).toBeLessThan(p.tdee);
    expect(p.macros.proteinG).toBeGreaterThan(0);
    expect(p.macros.carbsG).toBeGreaterThanOrEqual(0);
    expect(p.macros.fatG).toBeGreaterThan(0);
  });

  it("raises the target above TDEE for a gain", () => {
    const p = computeStartingPlan({ ...base, goalType: "gain" }, "2026-06-03");
    expect(p.dailyCalories).toBeGreaterThan(p.tdee);
  });

  it("equals TDEE for maintenance", () => {
    const p = computeStartingPlan({ ...base, goalType: "maintain" }, "2026-06-03");
    expect(Math.round(p.dailyCalories)).toBe(Math.round(p.tdee));
  });

  it("flags clamping when the requested rate is unsafe", () => {
    const p = computeStartingPlan({ ...base, rateKgPerWeek: 5 }, "2026-06-03");
    expect(p.clamped).toBe(true);
    expect(Math.abs(p.effectiveRateKgPerWeek)).toBeLessThan(5);
  });

  it("uses lean-mass-anchored protein when a direct body-fat % is given", () => {
    const withBf: Assessment = {
      ...base,
      bodyComp: { method: "direct", directBodyFatPct: 0.15, neckCm: null, waistCm: null, hipCm: null },
    };
    const p = computeStartingPlan(withBf, "2026-06-03");
    expect(p.usedComposition).toBe(true);
    expect(p.leanMassKg).toBeGreaterThan(0);
  });

  it("degrades to no composition when tape data is incomplete", () => {
    const incomplete: Assessment = {
      ...base,
      bodyComp: { method: "tape", directBodyFatPct: null, neckCm: 38, waistCm: null, hipCm: null },
    };
    const p = computeStartingPlan(incomplete, "2026-06-03");
    expect(p.usedComposition).toBe(false);
  });
});
