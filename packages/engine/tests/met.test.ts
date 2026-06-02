import { describe, expect, it } from "vitest";
import { activeCalories, metFor, totalActiveCalories } from "../src/met";
import { isoDate, kg, met, minutes } from "../src/types";

describe("activeCalories", () => {
  // 80 kg, 60 min easy run (MET 8): (8-1) * 80 * 1.0 = 560 kcal active
  it("formula matches (MET-1) * W * t", () => {
    expect(activeCalories(kg(80), metFor("run_easy"), 60)).toBeCloseTo(560);
  });

  it("clamps below-1 MET activities to zero active calories", () => {
    expect(activeCalories(kg(80), met(0.5), 60)).toBe(0);
  });

  it("scales linearly with duration and weight", () => {
    const a = activeCalories(kg(80), metFor("run_easy"), 60);
    const b = activeCalories(kg(80), metFor("run_easy"), 30);
    const c = activeCalories(kg(40), metFor("run_easy"), 60);
    expect(b).toBeCloseTo(a / 2);
    expect(c).toBeCloseTo(a / 2);
  });
});

describe("totalActiveCalories", () => {
  it("sums across blocks", () => {
    const w = kg(70);
    // 30 min run_easy + 60 min lift_light
    // (8-1)*70*0.5 = 245; (3.5-1)*70*1.0 = 175; total 420
    const sum = totalActiveCalories(w, [
      { date: isoDate("2026-06-01"), met: metFor("run_easy"),   durationMinutes: minutes(30) },
      { date: isoDate("2026-06-01"), met: metFor("lift_light"), durationMinutes: minutes(60) },
    ]);
    expect(sum).toBeCloseTo(420);
  });

  it("returns 0 for empty input", () => {
    expect(totalActiveCalories(kg(70), [])).toBe(0);
  });
});
