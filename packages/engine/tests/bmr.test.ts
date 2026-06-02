import { describe, expect, it } from "vitest";
import { mifflinStJeor } from "../src/bmr";
import { cm, kg, years } from "../src/types";

describe("mifflinStJeor", () => {
  // Reference: 30 yr, 80 kg, 180 cm male
  // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
  it("matches published male reference", () => {
    expect(
      mifflinStJeor({ sex: "male", age: years(30), heightCm: cm(180) }, kg(80)),
    ).toBeCloseTo(1780, 6);
  });

  // Reference: 30 yr, 65 kg, 165 cm female
  // 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161 = 1370.25
  it("matches published female reference", () => {
    expect(
      mifflinStJeor({ sex: "female", age: years(30), heightCm: cm(165) }, kg(65)),
    ).toBeCloseTo(1370.25, 6);
  });

  it("BMR increases with mass and decreases with age", () => {
    const base = mifflinStJeor({ sex: "male", age: years(30), heightCm: cm(180) }, kg(80));
    const heavier = mifflinStJeor({ sex: "male", age: years(30), heightCm: cm(180) }, kg(90));
    const older = mifflinStJeor({ sex: "male", age: years(50), heightCm: cm(180) }, kg(80));
    expect(heavier).toBeGreaterThan(base);
    expect(older).toBeLessThan(base);
  });
});
