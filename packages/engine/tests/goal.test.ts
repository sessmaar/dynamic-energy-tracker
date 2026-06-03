import { describe, expect, it } from "vitest";
import {
  clampedDailyTargetFromTdee, clampGoalToSafety,
  dailyTargetFromTdee, dailyTargetWithActivityCredit,
  distributeWeeklyTarget, weeklyEnergyDelta,
} from "../src/goal";
import { kcal, kcalDay } from "../src/types";

describe("dailyTargetFromTdee", () => {
  it("0.5 kg/week cut from TDEE 2500 → ~2057", () => {
    // 6200 * -0.5 / 7 = -442.86 → 2057.14
    expect(dailyTargetFromTdee(kcalDay(2500), { kgPerWeek: -0.5 })).toBeCloseTo(2057.14);
  });
  it("maintenance returns TDEE", () => {
    expect(dailyTargetFromTdee(kcalDay(2400), { kgPerWeek: 0 })).toBe(2400);
  });
  it("0.25 kg/week gain from TDEE 2400 → ~2621", () => {
    // 6200 * 0.25 / 7 = 221.43 → 2621.43
    expect(dailyTargetFromTdee(kcalDay(2400), { kgPerWeek: 0.25 })).toBeCloseTo(2621.43);
  });
});

describe("weeklyEnergyDelta", () => {
  it("equals kgPerWeek * 6200", () => {
    expect(weeklyEnergyDelta({ kgPerWeek: -0.5 })).toBe(-3100);
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

describe("goal clamping", () => {
  it("clampGoalToSafety restricts aggressive targets", () => {
    // 100kg body weight.
    // Max cut = -1.0% = -1kg/wk.
    // Max gain = 1.5% = 1.5kg/wk.
    expect(clampGoalToSafety(-2.0, 100)).toBe(-1.0);
    expect(clampGoalToSafety(2.0, 100)).toBe(1.5);
    expect(clampGoalToSafety(-0.5, 100)).toBe(-0.5);
  });

  it("clampedDailyTargetFromTdee returns clamped target and metadata", () => {
    const tdee = kcalDay(2500);
    const goal = { kgPerWeek: -2.0 }; // Too aggressive for 80kg (limit -0.8)
    const bodyWeight = 80;

    const result = clampedDailyTargetFromTdee(tdee, goal, bodyWeight);

    expect(result.clamped).toBe(true);
    expect(result.originalGoal).toBe(-2.0);
    expect(result.effectiveGoal).toBe(-0.8);
    // 2500 - (0.8 * 6200 / 7) = 2500 - 708.57 = 1791.43
    expect(result.target).toBeCloseTo(1791.43);
  });

  it("accepts custom clamping percentages", () => {
    expect(clampGoalToSafety(-2.0, 100, { maxCutPct: 0.02 })).toBe(-2.0);
    expect(clampGoalToSafety(2.0, 100, { maxGainPct: 0.01 })).toBe(1.0);
  });
});
