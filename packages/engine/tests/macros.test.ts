import { describe, expect, it } from "vitest";
import { computeMacroTargets, macrosToKcal } from "../src/macros";
import { kg } from "../src/types";

describe("computeMacroTargets", () => {
  it("80 kg cutting at 2000 kcal, 2.0 g/kg protein, 25% fat", () => {
    const t = computeMacroTargets(2000, kg(80));
    expect(t.proteinG).toBe(160);
    // fat = 2000 * 0.25 / 9 ≈ 55.6 → 56
    expect(t.fatG).toBe(56);
    // carbs use the *unrounded* fat kcal (500) so the trio sums exactly:
    // (2000 − 160·4 − 500) / 4 = 860 / 4 = 215
    expect(t.carbsG).toBe(215);
  });

  it("rounded macros sum back to ~ daily kcal (±5 from rounding)", () => {
    const t = computeMacroTargets(2400, kg(72));
    expect(Math.abs(macrosToKcal(t) - 2400)).toBeLessThanOrEqual(5);
  });

  it("clamps carbs to 0 when protein + fat exceed the budget", () => {
    // Tiny kcal target but high protein still asked for.
    const t = computeMacroTargets(800, kg(100), { proteinPerKg: 2.5, fatPct: 0.4 });
    expect(t.carbsG).toBe(0);
  });

  it("scales protein by lean mass when provided", () => {
    // 100 kg total, 80 kg lean.
    // Default multiplier for lean mass is 2.2 g/kg.
    // protein = 80 * 2.2 = 176g.
    const t = computeMacroTargets(2000, kg(100), { leanMassKg: kg(80) });
    expect(t.proteinG).toBe(176);
  });

  it("uses custom protein multiplier with lean mass", () => {
    // 80 kg lean * 2.5 g/kg = 200g.
    const t = computeMacroTargets(2000, kg(100), { leanMassKg: kg(80), proteinPerKg: 2.5 });
    expect(t.proteinG).toBe(200);
  });

  it("rejects invalid fatPct", () => {
    expect(() => computeMacroTargets(2000, kg(80), { fatPct: 1.5 })).toThrow(RangeError);
    expect(() => computeMacroTargets(2000, kg(80), { fatPct: -0.1 })).toThrow(RangeError);
  });
});
