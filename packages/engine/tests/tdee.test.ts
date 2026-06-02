import { describe, expect, it } from "vitest";
import {
  alphaForDaysWithBoth, computeWeeklyTdee, daysBetweenInclusive, updateTdeePosterior,
} from "../src/tdee";
import { isoDate, kcal, kcalDay, kg } from "../src/types";

const week = (start: string, len = 7) => {
  const dates: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < len; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
};

describe("daysBetweenInclusive", () => {
  it("counts inclusive day spans", () => {
    expect(daysBetweenInclusive(isoDate("2026-06-01"), isoDate("2026-06-07"))).toBe(7);
    expect(daysBetweenInclusive(isoDate("2026-06-01"), isoDate("2026-06-01"))).toBe(1);
  });
});

describe("computeWeeklyTdee", () => {
  it("recovers a maintenance TDEE from flat weight and constant intake", () => {
    const dates = week("2026-06-01");
    const intake = dates.map((date) => ({ date: isoDate(date), calories: kcal(2500) }));
    const weights = dates.map((date) => ({ date: isoDate(date), weight: kg(80) }));
    const r = computeWeeklyTdee(isoDate(dates[0]!), isoDate(dates[6]!), intake, weights);
    expect(r.tdeeWeek).toBeCloseTo(2500, 6);
    expect(r.deltaWeightKg).toBeCloseTo(0, 6);
    expect(r.daysWithBoth).toBe(7);
    expect(r.completeness).toBe(1);
  });

  it("infers a deficit when weight trends down", () => {
    // 2000 kcal/day intake, 0.5 kg trend-weight drop over the week.
    // TDEE = (Σ intake − k·Δw)/n = (14000 − 7700·(-0.5))/7 ≈ 2550 kcal/day.
    const dates = week("2026-06-01");
    const intake = dates.map((date) => ({ date: isoDate(date), calories: kcal(2000) }));
    // Trend drops by 0.5 kg over the week.
    const weights = dates.map((date, i) => ({
      date: isoDate(date),
      weight: kg(80 - 0.5 * (i / 6)),
    }));
    const r = computeWeeklyTdee(isoDate(dates[0]!), isoDate(dates[6]!), intake, weights, 1);
    expect(r.deltaWeightKg).toBeCloseTo(-0.5, 1);
    // Expect TDEE > intake when weight dropped.
    expect(r.tdeeWeek).toBeGreaterThan(2000);
    expect(r.tdeeWeek).toBeCloseTo(2550, 0);
  });

  it("completeness reflects missing days", () => {
    const dates = week("2026-06-01");
    // Intake only on 4 days; weights on all 7.
    const intake = dates.slice(0, 4).map((date) => ({ date: isoDate(date), calories: kcal(2500) }));
    const weights = dates.map((date) => ({ date: isoDate(date), weight: kg(80) }));
    const r = computeWeeklyTdee(isoDate(dates[0]!), isoDate(dates[6]!), intake, weights);
    expect(r.daysWithBoth).toBe(4);
    expect(r.completeness).toBeCloseTo(4 / 7);
  });

  it("rejects reversed window", () => {
    expect(() =>
      computeWeeklyTdee(isoDate("2026-06-07"), isoDate("2026-06-01"), [], []),
    ).toThrow(RangeError);
  });
});

describe("alphaForDaysWithBoth", () => {
  it("matches the PRD schedule", () => {
    expect(alphaForDaysWithBoth(7)).toBe(0.6);
    expect(alphaForDaysWithBoth(5)).toBe(0.6);
    expect(alphaForDaysWithBoth(4)).toBe(0.4);
    expect(alphaForDaysWithBoth(3)).toBe(0.4);
    expect(alphaForDaysWithBoth(2)).toBe(0);
    expect(alphaForDaysWithBoth(0)).toBe(0);
  });
});

describe("updateTdeePosterior", () => {
  it("blends week into prior at the right weight", () => {
    const r = updateTdeePosterior(kcalDay(2400), {
      weekStart: isoDate("2026-06-01"),
      tdeeWeek: kcalDay(2600),
      avgIntake: kcalDay(2400),
      deltaWeightKg: 0.1,
      daysWithBoth: 7,
      completeness: 1 as never,
    });
    // 0.6 * 2600 + 0.4 * 2400 = 2520
    expect(r.posterior).toBeCloseTo(2520);
    expect(r.alpha).toBe(0.6);
    expect(r.updated).toBe(true);
  });

  it("returns prior unchanged when data is insufficient", () => {
    const r = updateTdeePosterior(kcalDay(2400), {
      weekStart: isoDate("2026-06-01"),
      tdeeWeek: kcalDay(9999),
      avgIntake: kcalDay(0),
      deltaWeightKg: 0,
      daysWithBoth: 1,
      completeness: 0 as never,
    });
    expect(r.posterior).toBe(2400);
    expect(r.updated).toBe(false);
  });
});
