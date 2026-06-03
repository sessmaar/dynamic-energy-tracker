import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LEVELS, DEFAULT_ACTIVITY_LEVEL, PAL_FACTORS, palFactor, seedTdee,
} from "../src/activityLevel";
import { mifflinStJeor } from "../src/bmr";
import { compositionFrom, katchMcArdle } from "../src/bodyComposition";
import { cm, kg, unit, years } from "../src/types";

const profile = { sex: "male" as const, age: years(30), heightCm: cm(180) };
const weight = kg(80);
const bmr = mifflinStJeor(profile, weight); // 1780 (see bmr.test.ts)

describe("PAL factors", () => {
  it("matches the published Harris–Benedict / FAO-WHO-UNU multipliers", () => {
    expect(PAL_FACTORS).toEqual({
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      very: 1.725,
      extra: 1.9,
    });
  });

  it("is monotonic increasing across the ordered catalog", () => {
    const factors = ACTIVITY_LEVELS.map((l) => l.factor);
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]!).toBeGreaterThan(factors[i - 1]!);
    }
  });

  it("catalog factors agree with the PAL_FACTORS map", () => {
    for (const l of ACTIVITY_LEVELS) expect(l.factor).toBe(PAL_FACTORS[l.key]);
  });
});

describe("seedTdee", () => {
  it("is BMR × the level's PAL factor", () => {
    expect(seedTdee(profile, weight, "sedentary")).toBeCloseTo(bmr * 1.2, 6);
    expect(seedTdee(profile, weight, "moderate")).toBeCloseTo(bmr * 1.55, 6);
    expect(seedTdee(profile, weight, "extra")).toBeCloseTo(bmr * 1.9, 6);
  });

  it("defaults to the moderate tier when no level is given", () => {
    expect(seedTdee(profile, weight)).toBeCloseTo(
      seedTdee(profile, weight, DEFAULT_ACTIVITY_LEVEL),
      6,
    );
    expect(palFactor(DEFAULT_ACTIVITY_LEVEL)).toBe(1.55);
  });

  it("uses Katch–McArdle off lean mass when a composition is supplied", () => {
    const comp = compositionFrom(weight, unit(0.2)); // LBM 64 kg
    const expected = katchMcArdle(comp.leanMassKg) * 1.55;
    expect(seedTdee(profile, weight, "moderate", comp)).toBeCloseTo(expected, 6);
    // ...and that it actually differs from the Mifflin path for the same body.
    expect(seedTdee(profile, weight, "moderate", comp)).not.toBeCloseTo(
      seedTdee(profile, weight, "moderate"),
      0,
    );
  });

  it("separates lifestyles that the old blanket 1.4 collapsed together", () => {
    // The whole point: a sedentary user and a very-active user must NOT
    // get the same day-one number.
    const sed = seedTdee(profile, weight, "sedentary");
    const very = seedTdee(profile, weight, "very");
    expect(very - sed).toBeCloseTo(bmr * (1.725 - 1.2), 6);
    expect(very - sed).toBeGreaterThan(900); // ~935 kcal/day apart at 1780 BMR
  });
});
