import { describe, expect, it } from "vitest";
import { buildOnboardingWrite } from "./persistence";
import { initialAssessment, type Assessment } from "./assessment";

const a: Assessment = {
  ...initialAssessment,
  sex: "male",
  dateOfBirth: "1990-01-01",
  heightCm: 180,
  currentWeightKg: 80,
  activityLevel: "moderate",
  goalType: "cut",
  rateKgPerWeek: 0.5,
};

describe("buildOnboardingWrite", () => {
  it("builds a profile payload with metric units", () => {
    const w = buildOnboardingWrite(a, "user-1", "America/New_York", "2026-06-03");
    expect(w.profile.userId).toBe("user-1");
    expect(w.profile.sex).toBe("male");
    expect(w.profile.heightCm).toBe(180);
    expect(w.profile.initialWeightKg).toBe(80);
    expect(w.profile.timezone).toBe("America/New_York");
  });

  it("builds a goal with a safety-clamped negative rate for a cut", () => {
    const w = buildOnboardingWrite(a, "user-1", "UTC", "2026-06-03");
    expect(w.goal.goalType).toBe("cut");
    expect(w.goal.rateKgPerWeek).toBeLessThan(0);
    expect(w.goal.proteinGTarget).toBeGreaterThan(0);
  });

  it("emits an initial weight entry", () => {
    const w = buildOnboardingWrite(a, "user-1", "UTC", "2026-06-03");
    expect(w.weight.userId).toBe("user-1");
    expect(w.weight.weightKg).toBe(80);
    expect(w.weight.date).toBe("2026-06-03");
  });

  it("omits body measurement when method is skip", () => {
    const w = buildOnboardingWrite(a, "user-1", "UTC", "2026-06-03");
    expect(w.bodyMeasurement).toBeNull();
  });

  it("includes a body measurement for a direct body-fat reading", () => {
    const withBf: Assessment = { ...a, bodyComp: { method: "direct", directBodyFatPct: 0.15, neckCm: null, waistCm: null, hipCm: null } };
    const w = buildOnboardingWrite(withBf, "user-1", "UTC", "2026-06-03");
    expect(w.bodyMeasurement).not.toBeNull();
    expect(w.bodyMeasurement!.bodyFatPct).toBe(0.15);
  });
});
