import {
  type ActivityBlock, type IntakeEntry, type UserProfile,
  type WeightEntry, type WeeklyGoal,
  cm, isoDate, kcal, kg, met, minutes, years,
} from "@dynamic-energy/engine";
import type {
  ActivityBlockRow, DailyIntakeRow, FoodRow, GoalRow, MealItemRow, MealRow,
  ProfileRow, RecipeItemRow, RecipeRow, WeightEntryRow,
} from "./schema";

/**
 * Convert raw Postgres rows into engine-branded domain types. Branding
 * happens here, at the single seam between persistence and pure logic,
 * so the rest of the codebase doesn't need to know `weight_kg` is the
 * column name or that `number` came back from the wire.
 *
 * Going the other direction (`toRow`), we strip brands back to plain
 * numbers because supabase-js's typed insert/update doesn't care about
 * them and would fight us if we tried to pass branded values.
 */

const ageFromDob = (dob: string, now = new Date()): number => {
  const birth = new Date(`${dob}T00:00:00Z`);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
};

export const profileFromRow = (row: ProfileRow): UserProfile => ({
  sex: row.sex,
  age: years(ageFromDob(row.date_of_birth)),
  heightCm: cm(row.height_cm),
});

/**
 * Wider projection of the profile row including metadata the engine
 * itself doesn't consume (timezone, raw DOB, starting weight). The
 * mobile store wants these for "today in your timezone" math and for
 * showing the settings screen; the engine doesn't.
 */
export interface AccountProfile {
  profile: UserProfile;
  dateOfBirth: string;
  timezone: string;
  initialWeightKg: number;
  preferredUnits: "metric" | "imperial";
}

export const accountFromRow = (row: ProfileRow): AccountProfile => ({
  profile: profileFromRow(row),
  dateOfBirth: row.date_of_birth,
  timezone: row.timezone,
  initialWeightKg: row.initial_weight_kg,
  preferredUnits: row.preferred_units,
});

export const goalFromRow = (row: GoalRow): WeeklyGoal => ({
  // DB stores raw rate; sign is implicit in goal_type but the engine only
  // cares about the signed rate, so we apply the sign here.
  kgPerWeek:
    row.goal_type === "maintain" ? 0
    : row.goal_type === "cut" ? -Math.abs(row.goal_rate_kg_per_week)
    : Math.abs(row.goal_rate_kg_per_week),
});

/**
 * Richer goal projection including macro targets. Nullable fields stay
 * null when the user hasn't set targets — the UI hides macro progress in
 * that case rather than synthesizing values.
 */
export interface GoalWithMacros {
  weekly: WeeklyGoal;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export const goalWithMacrosFromRow = (row: GoalRow): GoalWithMacros => ({
  weekly: goalFromRow(row),
  proteinG: row.protein_g_target,
  carbsG: row.carbs_g_target,
  fatG: row.fat_g_target,
});

export const weightFromRow = (row: WeightEntryRow): WeightEntry => ({
  date: isoDate(row.date),
  weight: kg(row.weight_kg),
});

export const intakeFromRow = (row: DailyIntakeRow): IntakeEntry => ({
  date: isoDate(row.date),
  calories: kcal(row.calories),
});

// Food / meal mappers — these stay close to row shape (not engine
// branded types) because the engine doesn't care about per-meal detail;
// the UI consumes them directly.

export interface FoodSummary {
  id: string;
  name: string;
  brand: string | null;
  kcalPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  commonUnit: string | null;
  commonUnitGrams: number | null;
}

export const foodFromRow = (row: FoodRow): FoodSummary => ({
  id: row.id,
  name: row.name,
  brand: row.brand,
  kcalPer100g: row.kcal_per_100g,
  proteinPer100g: row.protein_g_per_100g,
  carbsPer100g: row.carbs_g_per_100g,
  fatPer100g: row.fat_g_per_100g,
  commonUnit: row.common_unit,
  commonUnitGrams: row.common_unit_grams,
});

export interface MealItemSummary {
  id: string;
  name: string;
  grams: number | null;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export const mealItemFromRow = (row: MealItemRow): MealItemSummary => ({
  id: row.id,
  name: row.name,
  grams: row.grams,
  kcal: row.kcal,
  proteinG: row.protein_g,
  carbsG: row.carbs_g,
  fatG: row.fat_g,
});

export interface RecipeItemSummary {
  id: string;
  name: string;
  grams: number | null;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  foodId: string | null;
}

export const recipeItemFromRow = (row: RecipeItemRow): RecipeItemSummary => ({
  id: row.id,
  name: row.name,
  grams: row.grams,
  kcal: row.kcal,
  proteinG: row.protein_g,
  carbsG: row.carbs_g,
  fatG: row.fat_g,
  foodId: row.food_id,
});

export interface RecipeSummary {
  id: string;
  name: string;
  notes: string | null;
  items: RecipeItemSummary[];
  totalKcal: number;
}

export const recipeFromRow = (row: RecipeRow, items: RecipeItemRow[]): RecipeSummary => ({
  id: row.id,
  name: row.name,
  notes: row.notes,
  items: items.map(recipeItemFromRow),
  totalKcal: items.reduce((s, i) => s + i.kcal, 0),
});

export interface MealSummary {
  id: string;
  date: string;
  mealType: MealRow["meal_type"];
  eatenAt: string | null;
  items: MealItemSummary[];
  totalKcal: number;
}

export const mealFromRow = (
  row: MealRow,
  items: MealItemRow[],
): MealSummary => ({
  id: row.id,
  date: row.date,
  mealType: row.meal_type,
  eatenAt: row.eaten_at,
  items: items.map(mealItemFromRow),
  totalKcal: items.reduce((s, i) => s + i.kcal, 0),
});

export const activityFromRow = (row: ActivityBlockRow): ActivityBlock => ({
  date: isoDate(row.date),
  met: met(row.met_value),
  durationMinutes: minutes(row.duration_min),
});

// Inverse direction lives in the repository layer — each `*.log()` or
// `*.upsert*()` method constructs the insert/update object inline so the
// typed supabase-js call site sees the literal shape. Centralizing those
// into helpers here would obscure the column names without buying us
// anything (they're already in one file).
