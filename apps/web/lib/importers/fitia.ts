import { read, utils } from "xlsx";
import type { MealType } from "../local-store";

export interface FitiaNutritionDay {
  date: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FitiaWeightEntry {
  date: string;
  weightKg: number;
}

export interface FitiaImportData {
  days: FitiaNutritionDay[];
  weights: FitiaWeightEntry[];
  skippedCount: number;
}

export function parseFitiaXlsx(buffer: ArrayBuffer): FitiaImportData {
  const wb = read(buffer, { type: "array" });
  
  const days: FitiaNutritionDay[] = [];
  const weights: FitiaWeightEntry[] = [];
  let skippedCount = 0;

  // 1. Nutrition Sheet
  const nutritionSheet = wb.Sheets["Nutrition"];
  if (nutritionSheet) {
    const nutritionRows = utils.sheet_to_json<any>(nutritionSheet);
    for (const row of nutritionRows) {
      const date = normalizeDate(row["Date"]);
      const kcal = Number(row["Energy (kcal)"]);
      if (date && kcal > 0) {
        days.push({
          date,
          kcal,
          proteinG: Number(row["Proteins (g)"]) || 0,
          carbsG: Number(row["Carbs (g)"]) || 0,
          fatG: Number(row["Fats (g)"]) || 0,
        });
      } else {
        skippedCount++;
      }
    }
  }

  // 2. Body Sheet
  const bodySheet = wb.Sheets["Body"];
  if (bodySheet) {
    const bodyRows = utils.sheet_to_json<any>(bodySheet);
    for (const row of bodyRows) {
      const date = normalizeDate(row["Date"]);
      const weight = Number(row["Weight (kg)"]);
      if (date && weight > 0) {
        weights.push({ date, weightKg: weight });
      }
    }
    // Sort weights by date
    weights.sort((a, b) => a.date.localeCompare(b.date));
  }

  return { days, weights, skippedCount };
}

function normalizeDate(val: any): string | null {
  if (!val) return null;
  
  // Excel serial number?
  if (typeof val === "number") {
    const d = utils.format_cell({ t: "n", v: val, z: "yyyy-mm-dd" });
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // Fallback if formatting fails
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }

  const s = String(val).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  
  // Try JS date
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  
  return null;
}

export function commitFitiaImport(
  data: FitiaImportData,
  repos: {
    meal: { add: (m: any) => void; listForDate: (d: string) => any[] };
    weight: { log: (w: any) => void; listSince: (d: string) => any[] };
  }
) {
  let addedDays = 0;
  let addedWeights = 0;
  let skippedDays = 0;
  let skippedWeights = 0;

  for (const day of data.days) {
    const existing = repos.meal.listForDate(day.date);
    if (existing.length === 0) {
      repos.meal.add({
        date: day.date,
        mealType: "quick_add" as MealType,
        items: [{
          name: "Fitia import",
          grams: null,
          kcal: day.kcal,
          proteinG: day.proteinG,
          carbsG: day.carbsG,
          fatG: day.fatG,
        }],
      });
      addedDays++;
    } else {
      skippedDays++;
    }
  }

  for (const w of data.weights) {
    const existing = repos.weight.listSince(w.date).filter(e => e.date === w.date);
    if (existing.length === 0) {
      repos.weight.log({
        date: w.date,
        weightKg: w.weightKg,
      });
      addedWeights++;
    } else {
      skippedWeights++;
    }
  }

  return { addedDays, addedWeights, skippedDays, skippedWeights };
}