import { describe, expect, it, beforeEach } from "vitest";
import { useLocalStore, initialLocalState } from "../../local-store";
import { initialAssessment, type Assessment } from "../assessment";
import { commitOnboarding } from "../persistence";

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

beforeEach(() => {
  localStorage.clear();
  useLocalStore.setState(initialLocalState);
});

describe("commitOnboarding", () => {
  it("writes profile to the store with the device timezone", () => {
    commitOnboarding(a, "America/New_York", "2026-06-03");
    const profile = useLocalStore.getState().profile;
    expect(profile).not.toBeNull();
    expect(profile!.sex).toBe("male");
    expect(profile!.heightCm).toBe(180);
    expect(profile!.initialWeightKg).toBe(80);
    expect(profile!.timezone).toBe("America/New_York");
  });

  it("writes goal with positive magnitude and macro targets", () => {
    commitOnboarding(a, "UTC", "2026-06-03");
    const g = useLocalStore.getState().goal;
    expect(g).not.toBeNull();
    expect(g!.type).toBe("cut");
    expect(g!.rateKgPerWeek).toBeGreaterThan(0); // magnitude
    expect(g!.proteinG).toBeGreaterThan(0);
    expect(g!.startDate).toBe("2026-06-03");
  });

  it("seeds the initial weight entry on the given date", () => {
    commitOnboarding(a, "UTC", "2026-06-03");
    const ws = useLocalStore.getState().weights;
    expect(ws).toHaveLength(1);
    expect(ws[0]!.date).toBe("2026-06-03");
    expect(ws[0]!.weightKg).toBe(80);
  });
});
