import { describe, expect, it } from "vitest";
import {
  dailyTargetFromTdee, dailyTargetWithActivityCredit,
  distributeWeeklyTarget, weeklyEnergyDelta,
} from "../src/goal";
import { kcal, kcalDay } from "../src/types";

describe("dailyTargetFromTdee", () => {
  it("0.5 kg/week cut from TDEE 2500 → ~1950", () => {
    // 7700 * -0.5 / 7 = -550 → 1950
    expect(dailyTargetFromTdee(kcalDay(2500), { kgPerWeek: -0.5 })).toBeCloseTo(1950);
  });
  it("maintenance returns TDEE", () => {
    expect(dailyTargetFromTdee(kcalDay(2400), { kgPerWeek: 0 })).toBe(2400);
  });
  it("0.25 kg/week gain from TDEE 2400 → ~2675", () => {
    expect(dailyTargetFromTdee(kcalDay(2400), { kgPerWeek: 0.25 })).toBeCloseTo(2675);
  });
});

describe("weeklyEnergyDelta", () => {
  it("equals kgPerWeek * 7700", () => {
    expect(weeklyEnergyDelta({ kgPerWeek: -0.5 })).toBe(-3850);
  });
});

describe("distributeWeeklyTarget", () => {
  it("returns 7 equal values when no boost asked or all/no training days", () => {
    const all = distributeWeeklyTarget(kcalDay(2000), Array(7).fill(true) as boolean[]);
    expect(all.every((v) => v === 2000)).toBe(true);
    const none = distributeWeeklyTarget(kcalDay(2000), Array(7).fill(false) as boolean[]);
    expect(none.every((v) => v === 2000)).toBe(true);
  });

  it("preserves the weekly sum exactly", () => {
    const isTraining = [true, false, true, false, true, false, false];
    const days = distributeWeeklyTarget(kcalDay(2000), isTraining, 0.1);
    const sum = days.reduce((s, d) => s + d, 0);
    expect(sum).toBeCloseTo(2000 * 7, 6);
  });

  it("training days are higher than rest days", () => {
    const days = distributeWeeklyTarget(kcalDay(2000), [true, false, true, false, true, false, false], 0.1);
    const trainingCal = days[0]!;
    const restCal = days[1]!;
    expect(trainingCal).toBeGreaterThan(restCal);
    expect(trainingCal).toBeCloseTo(2200);
  });

  it("rejects bad input", () => {
    expect(() => distributeWeeklyTarget(kcalDay(2000), [true])).toThrow(RangeError);
    expect(() => distributeWeeklyTarget(kcalDay(2000), Array(7).fill(false) as boolean[], 1))
      .toThrow(RangeError);
  });
});

describe("dailyTargetWithActivityCredit", () => {
  it("credits a fraction of surplus active calories", () => {
    expect(
      dailyTargetWithActivityCredit(kcalDay(2000), kcal(300), kcal(500), 0.6),
    ).toBeCloseTo(2120);
  });
  it("ignores under-shoot vs. plan", () => {
    expect(
      dailyTargetWithActivityCredit(kcalDay(2000), kcal(500), kcal(300), 0.6),
    ).toBe(2000);
  });
  it("rejects bad fraction", () => {
    expect(() =>
      dailyTargetWithActivityCredit(kcalDay(2000), kcal(0), kcal(0), 1.1),
    ).toThrow(RangeError);
  });
});
