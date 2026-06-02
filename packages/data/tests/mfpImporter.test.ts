import { describe, expect, it } from "vitest";
import { parseCsvLine, parseMfpCsv, parseMfpDate } from "../src/importers/myfitnesspal";

describe("parseCsvLine", () => {
  it("handles plain commas", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted fields with commas", () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });
  it("handles doubled quotes inside quoted fields", () => {
    expect(parseCsvLine('a,"b""c",d')).toEqual(["a", 'b"c', "d"]);
  });
});

describe("parseMfpDate", () => {
  it("accepts ISO", () => { expect(parseMfpDate("2026-01-15")).toBe("2026-01-15"); });
  it("accepts US slash", () => { expect(parseMfpDate("1/5/2026")).toBe("2026-01-05"); });
  it("rejects garbage", () => { expect(parseMfpDate("yesterday")).toBeNull(); });
});

describe("parseMfpCsv — food diary", () => {
  it("parses a typical MFP food export", () => {
    const csv = [
      "Date,Meal,Food,Calories,Fat (g),Carbs (g),Protein (g)",
      "2026-01-15,Breakfast,Oatmeal,300,5,55,10",
      '2026-01-15,Lunch,"Chicken, grilled",420,10,0,55',
      "2026-01-15,Snack,Banana,105,0.4,27,1.3",
    ].join("\n");
    const r = parseMfpCsv(csv);
    expect(r.meals).toHaveLength(3);
    expect(r.meals[0]).toMatchObject({
      date: "2026-01-15", mealType: "breakfast", name: "Oatmeal", kcal: 300, fatG: 5, carbsG: 55, proteinG: 10,
    });
    expect(r.meals[1]!.name).toBe("Chicken, grilled");
    expect(r.skipped).toHaveLength(0);
  });

  it("skips rows missing required fields", () => {
    const csv = [
      "Date,Meal,Food,Calories,Fat (g),Carbs (g),Protein (g)",
      ",Breakfast,Oatmeal,300,5,55,10",     // no date
      "2026-01-15,Lunch,,400,10,0,50",      // no name
      "2026-01-15,Dinner,Steak,,15,0,60",   // no kcal
      "2026-01-15,Snack,Banana,105,0.4,27,1.3",
    ].join("\n");
    const r = parseMfpCsv(csv);
    expect(r.meals).toHaveLength(1);
    expect(r.skipped).toHaveLength(3);
  });
});

describe("parseMfpCsv — measurements", () => {
  it("parses lb units and converts to kg", () => {
    const csv = [
      "Date,Weight (lb)",
      "2026-01-01,176.4",
      "2026-01-08,175.0",
    ].join("\n");
    const r = parseMfpCsv(csv);
    expect(r.weights).toHaveLength(2);
    expect(r.weights[0]).toMatchObject({ date: "2026-01-01" });
    expect(r.weights[0]!.weightKg).toBeCloseTo(80.01, 1);
  });

  it("parses kg directly", () => {
    const csv = ["Date,Weight (kg)", "2026-01-01,80.2"].join("\n");
    const r = parseMfpCsv(csv);
    expect(r.weights[0]!.weightKg).toBeCloseTo(80.2);
  });

  it("flags unrecognized headers", () => {
    const csv = "Foo,Bar\n1,2";
    const r = parseMfpCsv(csv);
    expect(r.meals).toHaveLength(0);
    expect(r.weights).toHaveLength(0);
    expect(r.skipped[0]?.reason).toBe("unrecognized header");
  });
});
