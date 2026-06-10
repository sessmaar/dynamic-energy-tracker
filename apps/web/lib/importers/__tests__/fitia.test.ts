import { describe, it, expect } from "vitest";
import { utils, write } from "xlsx";
import { parseFitiaXlsx } from "../fitia";

describe("Fitia Importer", () => {
  it("parses nutrition and body weight from a synthetic workbook", () => {
    // Create synthetic Fitia-style workbook
    const wb = utils.book_new();
    
    const nutritionData = [
      { "Date": "2026-06-01", "Energy (kcal)": 2000, "Proteins (g)": 150, "Carbs (g)": 200, "Fats (g)": 60 },
      { "Date": "2026-06-02", "Energy (kcal)": 0,    "Proteins (g)": 0,   "Carbs (g)": 0,   "Fats (g)": 0 }, // Should be skipped
      { "Date": "2026-06-03", "Energy (kcal)": 1800, "Proteins (g)": 140, "Carbs (g)": 180, "Fats (g)": 55 },
    ];
    utils.book_append_sheet(wb, utils.json_to_sheet(nutritionData), "Nutrition");
    
    const bodyData = [
      { "Date": "2026-06-01", "Weight (kg)": 80.5 },
      { "Date": "2026-06-03", "Weight (kg)": 80.2 },
    ];
    utils.book_append_sheet(wb, utils.json_to_sheet(bodyData), "Body");
    
    const buffer = write(wb, { type: "array", bookType: "xlsx" });
    const result = parseFitiaXlsx(buffer);
    
    expect(result.days).toHaveLength(2);
    expect(result.days[0]!.date).toBe("2026-06-01");
    expect(result.days[0]!.kcal).toBe(2000);
    expect(result.weights).toHaveLength(2);
    expect(result.weights[1]!.weightKg).toBe(80.2);
    expect(result.skippedCount).toBe(1);
  });
});