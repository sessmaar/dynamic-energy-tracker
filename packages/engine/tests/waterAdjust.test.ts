import { describe, expect, it } from "vitest";
import { carbWaterMassKg, medianCarbBaseline } from "../src/waterAdjust";

describe("carbWaterMassKg", () => {
  it("equal to baseline → 0", () => {
    expect(carbWaterMassKg(300, 300)).toBe(0);
  });

  it("100 g carbs over baseline ≈ 0.27 kg water", () => {
    // 100 * 2.7 / 1000 = 0.27
    expect(carbWaterMassKg(400, 300)).toBeCloseTo(0.27, 2);
  });

  it("below baseline → 0 (we don't credit below-baseline days)", () => {
    expect(carbWaterMassKg(200, 300)).toBe(0);
  });

  it("NaN inputs → 0 (defensive)", () => {
    expect(carbWaterMassKg(NaN, 300)).toBe(0);
    expect(carbWaterMassKg(300, NaN)).toBe(0);
  });
});

describe("medianCarbBaseline", () => {
  it("returns median for odd-length series", () => {
    expect(medianCarbBaseline([100, 200, 300])).toBe(200);
  });
  it("returns average of middle two for even-length series", () => {
    expect(medianCarbBaseline([100, 200, 300, 400])).toBe(250);
  });
  it("0 for empty input", () => {
    expect(medianCarbBaseline([])).toBe(0);
  });
  it("ignores NaN entries", () => {
    expect(medianCarbBaseline([100, NaN, 200, 300])).toBe(200);
  });
});
