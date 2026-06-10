import { describe, expect, it, beforeEach } from "vitest";
import { useLocalStore, initialLocalState } from "../local-store";
import { localRepos } from "../local-repos";

beforeEach(() => {
  localStorage.clear();
  useLocalStore.setState(initialLocalState);
});

describe("localRepos.weight.listSince", () => {
  it("returns engine-typed weights since the given date, sorted ascending", () => {
    useLocalStore.getState().addWeight({ date: "2026-06-01", weightKg: 80 });
    useLocalStore.getState().addWeight({ date: "2026-05-20", weightKg: 81 });
    const ws = localRepos.weight.listSince("2026-05-25");
    expect(ws).toHaveLength(1);
    expect(ws[0]!.weight).toBe(80);
  });
});

describe("localRepos.intake.listSince", () => {
  it("aggregates meal items per date into intake entries", () => {
    const s = useLocalStore.getState();
    s.addMeal({ date: "2026-06-01", mealType: "lunch", items: [{ name: "A", grams: 100, kcal: 300, proteinG: 20, carbsG: 30, fatG: 10 }] });
    s.addMeal({ date: "2026-06-01", mealType: "dinner", items: [{ name: "B", grams: 200, kcal: 500, proteinG: 30, carbsG: 50, fatG: 15 }] });
    s.addMeal({ date: "2026-05-30", mealType: "breakfast", items: [{ name: "C", grams: 50, kcal: 200, proteinG: 5, carbsG: 30, fatG: 5 }] });

    const intake = localRepos.intake.listSince("2026-05-31");
    expect(intake).toHaveLength(1);
    expect(intake[0]!.date).toBe("2026-06-01");
    expect(intake[0]!.calories).toBe(800);
    expect(intake[0]!.proteinG).toBe(50);
  });
});
