import { describe, expect, it, beforeEach } from "vitest";
import { useLocalStore, initialLocalState, type LocalProfile } from "../local-store";

const profile: LocalProfile = {
  sex: "male",
  dateOfBirth: "1990-01-01",
  heightCm: 180,
  initialWeightKg: 80,
  units: "metric",
  timezone: "UTC",
  activityLevel: "moderate",
};

describe("useLocalStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useLocalStore.setState(initialLocalState);
  });

  it("starts empty", () => {
    expect(useLocalStore.getState().profile).toBeNull();
    expect(useLocalStore.getState().weights).toEqual([]);
  });

  it("setProfile persists the profile", () => {
    useLocalStore.getState().setProfile(profile);
    expect(useLocalStore.getState().profile).toEqual(profile);
  });

  it("addWeight appends a weight entry", () => {
    useLocalStore.getState().addWeight({ date: "2026-06-01", weightKg: 80 });
    const ws = useLocalStore.getState().weights;
    expect(ws).toHaveLength(1);
    expect(ws[0]!.weightKg).toBe(80);
    expect(ws[0]!.id).toBeTruthy();
  });

  it("addMeal appends a meal", () => {
    useLocalStore.getState().addMeal({
      date: "2026-06-01",
      mealType: "lunch",
      items: [{ name: "Oats", grams: 50, kcal: 180, proteinG: 6, carbsG: 32, fatG: 3 }],
    });
    const meals = useLocalStore.getState().meals;
    expect(meals).toHaveLength(1);
    expect(meals[0]!.items[0]!.kcal).toBe(180);
  });

  it("reset clears everything", () => {
    useLocalStore.getState().setProfile(profile);
    useLocalStore.getState().reset();
    expect(useLocalStore.getState().profile).toBeNull();
  });
});
