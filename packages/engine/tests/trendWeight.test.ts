import { describe, expect, it } from "vitest";
import { ewmaTrend, latestTrendWeight } from "../src/trendWeight";
import { isoDate, kg } from "../src/types";

describe("ewmaTrend", () => {
  it("returns empty for empty input", () => {
    expect(ewmaTrend([])).toEqual([]);
  });

  it("smooths a noisy series toward the underlying value", () => {
    // Underlying 80, noise ±2; latest trend should sit much closer to 80
    // than the most recent raw point.
    const entries = [80, 82, 78, 81, 79, 80, 81, 79, 80, 82].map((w, i) => ({
      date: isoDate(`2026-06-${String(i + 1).padStart(2, "0")}`),
      weight: kg(w),
    }));
    const trend = latestTrendWeight(entries)!;
    expect(trend).toBeGreaterThan(79);
    expect(trend).toBeLessThan(81);
  });

  it("sorts unordered input", () => {
    const a = ewmaTrend([
      { date: isoDate("2026-06-02"), weight: kg(82) },
      { date: isoDate("2026-06-01"), weight: kg(80) },
    ]);
    expect(a[0]!.date).toBe("2026-06-01");
    expect(a[1]!.date).toBe("2026-06-02");
  });

  it("rejects invalid alpha", () => {
    expect(() => ewmaTrend([], 0)).toThrow(RangeError);
    expect(() => ewmaTrend([], 1.1)).toThrow(RangeError);
  });

  it("alpha=1 collapses to the raw series", () => {
    const series = ewmaTrend(
      [
        { date: isoDate("2026-06-01"), weight: kg(80) },
        { date: isoDate("2026-06-02"), weight: kg(82) },
      ],
      1,
    );
    expect(series[0]!.trend).toBe(80);
    expect(series[1]!.trend).toBe(82);
  });
});
