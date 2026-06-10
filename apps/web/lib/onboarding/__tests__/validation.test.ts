import { describe, expect, it } from "vitest";
import { isStepValid } from "../validation";
import { initialAssessment, type Assessment } from "../assessment";

const ok: Assessment = { ...initialAssessment };

describe("isStepValid", () => {
  it("about-you requires positive height/weight and a sane DOB", () => {
    expect(isStepValid("aboutYou", ok)).toBe(true);
    expect(isStepValid("aboutYou", { ...ok, heightCm: 0 })).toBe(false);
    expect(isStepValid("aboutYou", { ...ok, currentWeightKg: -1 })).toBe(false);
    expect(isStepValid("aboutYou", { ...ok, dateOfBirth: "not-a-date" })).toBe(false);
  });

  it("body-comp: skip always valid; direct needs a 0..1 fraction", () => {
    expect(isStepValid("bodyComp", { ...ok, bodyComp: { ...ok.bodyComp, method: "skip" } })).toBe(true);
    expect(isStepValid("bodyComp", { ...ok, bodyComp: { ...ok.bodyComp, method: "direct", directBodyFatPct: 0.15 } })).toBe(true);
    expect(isStepValid("bodyComp", { ...ok, bodyComp: { ...ok.bodyComp, method: "direct", directBodyFatPct: 1.5 } })).toBe(false);
    expect(isStepValid("bodyComp", { ...ok, bodyComp: { ...ok.bodyComp, method: "direct", directBodyFatPct: null } })).toBe(false);
  });

  it("body-comp tape needs neck+waist for males, plus hip for females", () => {
    const maleTape = { ...ok, sex: "male" as const, bodyComp: { ...ok.bodyComp, method: "tape" as const, neckCm: 38, waistCm: 84, hipCm: null } };
    expect(isStepValid("bodyComp", maleTape)).toBe(true);
    const femaleNoHip = { ...ok, sex: "female" as const, bodyComp: { ...ok.bodyComp, method: "tape" as const, neckCm: 32, waistCm: 70, hipCm: null } };
    expect(isStepValid("bodyComp", femaleNoHip)).toBe(false);
  });

  it("goal: maintain always valid; cut/gain need a positive rate", () => {
    expect(isStepValid("goal", { ...ok, goalType: "maintain" })).toBe(true);
    expect(isStepValid("goal", { ...ok, goalType: "cut", rateKgPerWeek: 0 })).toBe(false);
    expect(isStepValid("goal", { ...ok, goalType: "cut", rateKgPerWeek: 0.5 })).toBe(true);
  });

  it("diet custom needs protein/kg and a 0..1 fat fraction", () => {
    expect(isStepValid("diet", { ...ok, dietPattern: "balanced" })).toBe(true);
    expect(isStepValid("diet", { ...ok, dietPattern: "custom", customProteinPerKg: 2.0, customFatPct: 0.3 })).toBe(true);
    expect(isStepValid("diet", { ...ok, dietPattern: "custom", customProteinPerKg: null, customFatPct: 0.3 })).toBe(false);
    expect(isStepValid("diet", { ...ok, dietPattern: "custom", customProteinPerKg: 2.0, customFatPct: 2 })).toBe(false);
  });

  it("welcome, activity, reminders, plan are always passable", () => {
    expect(isStepValid("welcome", ok)).toBe(true);
    expect(isStepValid("activity", ok)).toBe(true);
    expect(isStepValid("reminders", ok)).toBe(true);
    expect(isStepValid("plan", ok)).toBe(true);
  });
});
