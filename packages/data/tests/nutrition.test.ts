import { describe, expect, it } from "vitest";
import { computeMealItemNutrition } from "../src/repositories";

describe("computeMealItemNutrition", () => {
  it("scales kcal + macros linearly with grams", () => {
    // Oats: 380 kcal/100g, 13 P, 67 C, 7 F
    const oats = { kcalPer100g: 380, proteinPer100g: 13, carbsPer100g: 67, fatPer100g: 7 };
    const half = computeMealItemNutrition(oats, 50);
    expect(half).toEqual({ kcal: 190, proteinG: 6.5, carbsG: 33.5, fatG: 3.5 });
  });

  it("passes null macros through", () => {
    const r = computeMealItemNutrition(
      { kcalPer100g: 200, proteinPer100g: null, carbsPer100g: null, fatPer100g: null },
      100,
    );
    expect(r).toEqual({ kcal: 200, proteinG: null, carbsG: null, fatG: null });
  });

  it("rounds kcal to integers (logs read as integers, not decimals)", () => {
    const r = computeMealItemNutrition({ kcalPer100g: 137, proteinPer100g: null, carbsPer100g: null, fatPer100g: null }, 73);
    expect(r.kcal).toBe(100); // 100.01 → 100
  });
});
