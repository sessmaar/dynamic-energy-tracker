import { describe, expect, it } from "vitest";
import {
  analyzeTrend, classifyTrajectory, expectedRateFromBalance, fullTrajectory,
} from "../src/trendAnalysis";
import { isoDate, kcal, kg } from "../src/types";

const series = (kgPerDayPattern: readonly number[], startDate = "2026-06-01") =>
  kgPerDayPattern.map((w, i) => {
    const d = new Date(`${startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: isoDate(d.toISOString().slice(0, 10)), weight: kg(w) };
  });

describe("analyzeTrend — slope recovery", () => {
  it("flat weight series → ~0 slope, CI brackets zero", () => {
    const weights = series(Array(14).fill(80));
    const a = analyzeTrend(weights)!;
    expect(Math.abs(a.ratePerWeek)).toBeLessThan(0.02);
    expect(a.ratePerWeekCI.lo).toBeLessThanOrEqual(0);
    expect(a.ratePerWeekCI.hi).toBeGreaterThanOrEqual(0);
  });

  it("linear downtrend → recovers slope within tolerance", () => {
    // 80 → 79.3 over 14 days = -0.05 kg/day = -0.35 kg/week.
    const linear = Array.from({ length: 14 }, (_, i) => 80 - 0.05 * i);
    const a = analyzeTrend(linear.map((v, i) => {
      const d = new Date("2026-06-01T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      return { date: isoDate(d.toISOString().slice(0, 10)), weight: kg(v) };
    }), { ewmaAlpha: 1 })!; // alpha=1 means trend == raw, so we test the regression cleanly
    expect(a.ratePerWeek).toBeCloseTo(-0.35, 1);
    expect(a.ratePerWeekSE).toBeLessThan(0.05);
  });

  it("returns null when too little data", () => {
    expect(analyzeTrend(series([80, 80]))).toBeNull();
    expect(analyzeTrend([])).toBeNull();
  });

  it("residual SD reflects noise — flat input has near-zero residuals", () => {
    const a = analyzeTrend(series(Array(14).fill(80)), { ewmaAlpha: 1 })!;
    expect(a.residualSDKg).toBeLessThan(0.01);
  });

  it("rawDailySDKg captures actual scale variability", () => {
    // Alternating ±1 kg around 80 → SD ≈ 1
    const noisy = Array.from({ length: 14 }, (_, i) => 80 + (i % 2 === 0 ? 1 : -1));
    const a = analyzeTrend(series(noisy))!;
    expect(a.rawDailySDKg).toBeGreaterThan(0.9);
    expect(a.rawDailySDKg).toBeLessThan(1.1);
  });
});

describe("classifyTrajectory", () => {
  it("flat data → maintaining", () => {
    const a = analyzeTrend(series(Array(14).fill(80)), { ewmaAlpha: 1 })!;
    const v = classifyTrajectory(a);
    expect(v.status).toBe("maintaining");
    expect(v.cue).toMatch(/HOLDING/);
  });

  it("strong downtrend with tight CI → losing", () => {
    const linear = Array.from({ length: 28 }, (_, i) => 80 - 0.07 * i);
    const a = analyzeTrend(linear.map((v, i) => {
      const d = new Date("2026-06-01T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      return { date: isoDate(d.toISOString().slice(0, 10)), weight: kg(v) };
    }), { windowDays: 28, ewmaAlpha: 1 })!;
    const v = classifyTrajectory(a);
    expect(v.status).toBe("losing");
    expect(v.cue).toMatch(/LOSING/);
  });

  it("alternating raw weights → inconclusive (CI swallows the trend)", () => {
    // ±1.5 kg alternation + small +0.05/day drift. With raw weights
    // (alpha = 1, no smoothing) the residual SD is enormous and the
    // slope's CI crosses zero — exactly the case where the engine
    // should refuse to commit to a verdict.
    const noisy = Array.from({ length: 14 }, (_, i) =>
      80 + (i % 2 === 0 ? 1.5 : -1.5) + 0.05 * i,
    );
    const a = analyzeTrend(series(noisy), { ewmaAlpha: 1 })!;
    const v = classifyTrajectory(a);
    expect(["inconclusive", "maintaining"]).toContain(v.status);
  });

  it("'on track' set when actual ≈ goal", () => {
    const linear = Array.from({ length: 28 }, (_, i) => 80 - 0.07 * i);
    const a = analyzeTrend(linear.map((v, i) => {
      const d = new Date("2026-06-01T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      return { date: isoDate(d.toISOString().slice(0, 10)), weight: kg(v) };
    }), { windowDays: 28, ewmaAlpha: 1 })!;
    const v = classifyTrajectory(a, { goalRatePerWeek: -0.49 }); // -0.07 * 7
    expect(v.onTrack).toBe(true);
    expect(v.cue).toMatch(/on target/);
  });
});

describe("expectedRateFromBalance", () => {
  it("intake equal to TDEE → ~0 expected rate", () => {
    const intake = Array.from({ length: 14 }, (_, i) => {
      const d = new Date("2026-06-01T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      return { date: isoDate(d.toISOString().slice(0, 10)), calories: kcal(2500) };
    });
    expect(expectedRateFromBalance(intake, 2500)).toBeCloseTo(0, 5);
  });

  it("500 kcal/day deficit → ~-0.45 kg/week", () => {
    // 7 * 500 / 7700 = 0.4545
    const intake = Array.from({ length: 14 }, (_, i) => {
      const d = new Date("2026-06-01T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      return { date: isoDate(d.toISOString().slice(0, 10)), calories: kcal(2000) };
    });
    expect(expectedRateFromBalance(intake, 2500)).toBeCloseTo(-0.4545, 2);
  });

  it("returns null when intake is sparse", () => {
    expect(expectedRateFromBalance([], 2500)).toBeNull();
  });
});

describe("fullTrajectory", () => {
  it("packages everything when there's enough data", () => {
    const weights = series(Array(14).fill(0).map((_, i) => 80 - 0.05 * i));
    const intake = Array.from({ length: 14 }, (_, i) => {
      const d = new Date("2026-06-01T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      return { date: isoDate(d.toISOString().slice(0, 10)), calories: kcal(2000) };
    });
    const r = fullTrajectory(weights, { intake, tdee: 2500, goalRatePerWeek: -0.5 });
    expect(r).not.toBeNull();
    expect(r!.verdict.expectedRatePerWeek).toBeCloseTo(-0.4545, 2);
  });
});
