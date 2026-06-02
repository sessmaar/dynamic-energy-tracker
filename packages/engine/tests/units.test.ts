import { describe, expect, it } from "vitest";
import {
  cmToFtIn, cmToInches, ftInToCm, inchesToCm, kgToLb, lbToKg,
} from "../src/units";

describe("mass conversions", () => {
  it("roundtrips kg ↔ lb", () => {
    expect(lbToKg(kgToLb(80))).toBeCloseTo(80, 6);
  });
  it("80 kg → ~176.4 lb", () => {
    expect(kgToLb(80)).toBeCloseTo(176.37, 1);
  });
});

describe("height conversions", () => {
  it("180 cm ≈ 70.87 in ≈ 5'11\"", () => {
    expect(cmToInches(180)).toBeCloseTo(70.87, 1);
    expect(cmToFtIn(180)).toEqual({ feet: 5, inches: 11 });
  });
  it("5'10\" → ~177.8 cm", () => {
    expect(ftInToCm(5, 10)).toBeCloseTo(177.8, 1);
  });
  it("roundtrips cm ↔ inches", () => {
    expect(inchesToCm(cmToInches(165))).toBeCloseTo(165, 6);
  });
});
