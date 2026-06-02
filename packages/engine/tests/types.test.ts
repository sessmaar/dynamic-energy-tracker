import { describe, expect, it } from "vitest";
import { cm, isoDate, kcal, kg, met, minutes, minutesToHours, unit, years } from "../src/types";

describe("branded constructors", () => {
  it("kg/cm/met reject non-positive", () => {
    expect(() => kg(0)).toThrow(RangeError);
    expect(() => kg(-1)).toThrow(RangeError);
    expect(() => cm(0)).toThrow(RangeError);
    expect(() => met(0)).toThrow(RangeError);
  });

  it("years/minutes accept 0", () => {
    expect(years(0)).toBe(0);
    expect(minutes(0)).toBe(0);
  });

  it("kcal accepts negatives (deficits exist)", () => {
    expect(kcal(-500)).toBe(-500);
  });

  it("unit clamps to [0,1]", () => {
    expect(unit(0)).toBe(0);
    expect(unit(1)).toBe(1);
    expect(() => unit(-0.01)).toThrow(RangeError);
    expect(() => unit(1.01)).toThrow(RangeError);
  });

  it("reject non-finite", () => {
    expect(() => kg(NaN)).toThrow(RangeError);
    expect(() => kg(Infinity)).toThrow(RangeError);
  });

  it("minutesToHours converts correctly", () => {
    expect(minutesToHours(minutes(90))).toBeCloseTo(1.5);
  });
});

describe("isoDate", () => {
  it("accepts well-formed dates", () => {
    expect(isoDate("2026-06-01")).toBe("2026-06-01");
  });
  it("rejects malformed dates", () => {
    expect(() => isoDate("2026-6-1")).toThrow(RangeError);
    expect(() => isoDate("06/01/2026")).toThrow(RangeError);
    expect(() => isoDate("2026-13-01")).toThrow(RangeError);
  });
});
