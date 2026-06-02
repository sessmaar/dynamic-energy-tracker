/**
 * MyFitnessPal CSV importer.
 *
 * MFP's "Export to CSV" emits two separate files: one for food diary
 * entries and one for measurements. We accept either by detecting the
 * header row and dispatching to the right parser. The output is two
 * arrays the caller can preview and then hand to the meal/weight repos.
 *
 * No UI here — this module is pure: input string → typed records. That
 * makes it trivially testable and lets mobile/web build different
 * preview UIs without duplicating parser logic.
 */

export interface ImportedMealItem {
  date: string;            // YYYY-MM-DD
  mealType: "breakfast" | "lunch" | "dinner" | "snack" | "quick_add";
  name: string;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  grams: number | null;    // MFP doesn't always export portion grams
}

export interface ImportedWeightEntry {
  date: string;
  weightKg: number;
}

export interface ImportPreview {
  meals: ImportedMealItem[];
  weights: ImportedWeightEntry[];
  /** Rows we couldn't parse (header mismatch, bad numbers, etc.). */
  skipped: { line: number; reason: string; raw: string }[];
}

/** Naive CSV row parser that handles quoted fields with embedded commas. */
export const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else cur += c;
    } else {
      if (c === ",") { out.push(cur); cur = ""; }
      else if (c === '"') inQuotes = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
};

/** MFP-style date parser. They export `2026-01-15` or `1/15/2026`. */
export const parseMfpDate = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mo, da, yr] = m;
    return `${yr}-${mo!.padStart(2, "0")}-${da!.padStart(2, "0")}`;
  }
  return null;
};

/** MFP weight column can be in kg or lb depending on user prefs. */
const lbToKg = (lb: number): number => lb * 0.45359237;

const num = (s: string | undefined): number | null => {
  if (s == null) return null;
  const cleaned = s.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const normalizeMealType = (raw: string): ImportedMealItem["mealType"] => {
  const lower = raw.toLowerCase().trim();
  if (lower.startsWith("break")) return "breakfast";
  if (lower.startsWith("lunch")) return "lunch";
  if (lower.startsWith("dinner")) return "dinner";
  if (lower.startsWith("snack")) return "snack";
  return "quick_add";
};

/**
 * Parse an MFP CSV file. The header row is sniffed for whether this is a
 * food export or a measurements export. Mixed files are not supported
 * (MFP doesn't produce them).
 */
export const parseMfpCsv = (text: string): ImportPreview => {
  const out: ImportPreview = { meals: [], weights: [], skipped: [] };
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) return out;

  const header = parseCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());

  // --- food diary export ---
  // Typical columns: Date, Meal, Food, Calories, Fat (g), Carbs (g), Protein (g), ...
  if (header.includes("food") && header.includes("calories")) {
    const idx = {
      date: header.indexOf("date"),
      meal: header.indexOf("meal"),
      food: header.indexOf("food"),
      kcal: header.indexOf("calories"),
      fat: header.findIndex((h) => h.startsWith("fat")),
      carbs: header.findIndex((h) => h.startsWith("carb")),
      protein: header.findIndex((h) => h.startsWith("protein")),
    };
    for (let li = 1; li < lines.length; li++) {
      const cells = parseCsvLine(lines[li]!);
      const date = idx.date >= 0 ? parseMfpDate(cells[idx.date] ?? "") : null;
      const kcal = idx.kcal >= 0 ? num(cells[idx.kcal]) : null;
      const name = idx.food >= 0 ? cells[idx.food]?.trim() : "";
      if (!date || kcal == null || !name) {
        out.skipped.push({ line: li + 1, reason: "missing date / kcal / name", raw: lines[li]! });
        continue;
      }
      out.meals.push({
        date,
        mealType: idx.meal >= 0 ? normalizeMealType(cells[idx.meal] ?? "") : "quick_add",
        name,
        kcal: Math.round(kcal),
        proteinG: idx.protein >= 0 ? num(cells[idx.protein]) : null,
        carbsG: idx.carbs >= 0 ? num(cells[idx.carbs]) : null,
        fatG: idx.fat >= 0 ? num(cells[idx.fat]) : null,
        grams: null,
      });
    }
    return out;
  }

  // --- measurements export ---
  // Typical columns: Date, Weight  (units depend on the account)
  if (header.includes("weight") || header.includes("weight (kg)") || header.includes("weight (lb)")) {
    const dateIdx = header.indexOf("date");
    const kgIdx = header.indexOf("weight (kg)");
    const lbIdx = header.indexOf("weight (lb)");
    const plainIdx = header.indexOf("weight");
    for (let li = 1; li < lines.length; li++) {
      const cells = parseCsvLine(lines[li]!);
      const date = dateIdx >= 0 ? parseMfpDate(cells[dateIdx] ?? "") : null;
      let weightKg: number | null = null;
      if (kgIdx >= 0) weightKg = num(cells[kgIdx]);
      else if (lbIdx >= 0) {
        const lb = num(cells[lbIdx]);
        weightKg = lb !== null ? Number(lbToKg(lb).toFixed(2)) : null;
      } else if (plainIdx >= 0) {
        // Ambiguous units — assume kg. Caller can rescale in the preview UI.
        weightKg = num(cells[plainIdx]);
      }
      if (!date || weightKg == null || weightKg <= 0) {
        out.skipped.push({ line: li + 1, reason: "missing date / invalid weight", raw: lines[li]! });
        continue;
      }
      out.weights.push({ date, weightKg });
    }
    return out;
  }

  out.skipped.push({ line: 1, reason: "unrecognized header", raw: lines[0]! });
  return out;
};
