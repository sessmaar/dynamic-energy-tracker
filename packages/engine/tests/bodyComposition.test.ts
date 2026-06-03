import { describe, expect, it } from "vitest";
import {
  compositionFrom, katchMcArdle, leanMass, navyBodyFatPct,
} from "../src/bodyComposition";
import { cm, kg, unit } from "../src/types";

describe("navyBodyFatPct", () => {
  // Male: 180 cm, neck 38, waist 85 → ~16.1% by the metric Navy equation.
  it("matches a hand-computed male reference", () => {
    const bf = navyBodyFatPct("male", cm(180), cm(38), cm(85));
    expect(bf).toBeCloseTo(0.1612, 3);
  });

  // Female: 165 cm, neck 32, waist 70, hip 95 → ~24.9%.
  it("matches a hand-computed female reference", () => {
    const bf = navyBodyFatPct("female", cm(165), cm(32), cm(70), cm(95));
    expect(bf).toBeCloseTo(0.2488, 3);
  });

  it("requires a hip measurement for women", () => {
    expect(() => navyBodyFatPct("female", cm(165), cm(32), cm(70))).toThrow(/hip/i);
  });

  it("rejects a waist that does not exceed the neck", () => {
    expect(() => navyBodyFatPct("male", cm(180), cm(40), cm(38))).toThrow(/waist/i);
  });

  it("clamps implausible results into the physiological band", () => {
    // Enormous waist would push %BF past 60%; it must clamp, not run away.
    const bf = navyBodyFatPct("male", cm(180), cm(38), cm(300));
    expect(bf).toBeLessThanOrEqual(0.6);
    expect(bf).toBeGreaterThan(0.3);
  });
});

describe("leanMass / katchMcArdle", () => {
  it("lean mass is weight minus the fat fraction", () => {
    expect(leanMass(kg(80), unit(0.25))).toBeCloseTo(60, 6);
  });

  it("Katch–McArdle is 370 + 21.6 × LBM", () => {
    expect(katchMcArdle(kg(60))).toBeCloseTo(370 + 21.6 * 60, 6); // 1666
  });

  it("compositionFrom derives lean mass from weight + body fat", () => {
    const c = compositionFrom(kg(80), unit(0.2));
    expect(c.bodyFatPct).toBe(0.2);
    expect(c.leanMassKg).toBeCloseTo(64, 6);
  });
});
