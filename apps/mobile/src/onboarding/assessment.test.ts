import { describe, expect, it } from "vitest";
import { assessmentReducer, initialAssessment, type Assessment } from "./assessment";

describe("assessmentReducer", () => {
  it("starts with sensible metric defaults", () => {
    expect(initialAssessment.units).toBe("metric");
    expect(initialAssessment.sex).toBe("male");
    expect(initialAssessment.activityLevel).toBe("moderate");
    expect(initialAssessment.goalType).toBe("cut");
    expect(initialAssessment.dietPattern).toBe("balanced");
    expect(initialAssessment.bodyComp.method).toBe("skip");
  });

  it("patches a top-level field immutably", () => {
    const next = assessmentReducer(initialAssessment, { type: "set", patch: { heightCm: 182 } });
    expect(next.heightCm).toBe(182);
    expect(initialAssessment.heightCm).not.toBe(182);
  });

  it("patches nested body-composition state", () => {
    const next = assessmentReducer(initialAssessment, {
      type: "setBodyComp",
      patch: { method: "tape", neckCm: 38, waistCm: 84 },
    });
    expect(next.bodyComp.method).toBe("tape");
    expect(next.bodyComp.neckCm).toBe(38);
    expect(next.bodyComp.waistCm).toBe(84);
  });

  it("patches nested reminders state", () => {
    const next = assessmentReducer(initialAssessment, {
      type: "setReminders",
      patch: { logging: true, weighIn: true },
    });
    expect(next.reminders.logging).toBe(true);
    expect(next.reminders.weighIn).toBe(true);
  });
});
