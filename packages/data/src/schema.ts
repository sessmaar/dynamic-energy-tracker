/**
 * Database row types. These mirror the SQL schema in
 * supabase/migrations/0001_init.sql. Kept hand-written for now —
 * once the schema stabilizes, swap to `supabase gen types typescript`
 * output and delete this file.
 *
 * All numeric columns come back from supabase-js as `number`. Date
 * columns come back as ISO `YYYY-MM-DD` strings; timestamps as ISO
 * `2026-06-01T12:34:56Z` strings.
 */

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very" | "extra";
export type GoalType = "cut" | "maintain" | "gain";
export type GoalStatus = "active" | "paused" | "completed";
export type WeightSource = "manual" | "healthkit" | "import";

export interface ProfileRow {
  id: string;
  sex: Sex;
  date_of_birth: string;
  height_cm: number;
  initial_weight_kg: number;
  timezone: string;
  preferred_units: "metric" | "imperial";
  activity_level: ActivityLevel;
  created_at: string;
  updated_at: string;
}

export interface GoalRow {
  id: string;
  user_id: string;
  goal_type: GoalType;
  goal_rate_kg_per_week: number;
  start_date: string;
  end_date: string | null;
  status: GoalStatus;
  protein_g_target: number | null;
  carbs_g_target: number | null;
  fat_g_target: number | null;
  created_at: string;
}

export interface WeightEntryRow {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  source: WeightSource;
  note: string | null;
  created_at: string;
}

/**
 * One body-composition assessment. Circumferences are nullable because a
 * row may carry only a directly-measured `body_fat_pct` (from DEXA / smart
 * scale / import) instead of tape inputs, or vice versa. See migration
 * 0007. `body_fat_pct` is a 0..1 fraction.
 */
export interface BodyMeasurementRow {
  id: string;
  user_id: string;
  date: string;
  neck_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  source: WeightSource;
  note: string | null;
  created_at: string;
}

/** Pointer to a progress photo in the private `progress-photos` bucket. */
export interface ProgressPhotoRow {
  id: string;
  user_id: string;
  date: string;
  storage_path: string;
  note: string | null;
  created_at: string;
}

/**
 * `intake_logs` was dropped in 0002_meals.sql and replaced by the
 * `v_daily_intake` view, which aggregates meal_items. This row type
 * matches the columns the view returns — engine code reading
 * `IntakeEntry` keeps working unchanged.
 */
export interface DailyIntakeRow {
  user_id: string;
  date: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export type FoodSource = "off" | "usda" | "custom" | "quick_add";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "quick_add";

export interface FoodRow {
  id: string;
  source: FoodSource;
  source_ref: string | null;
  name: string;
  brand: string | null;
  serving_size_g: number | null;
  kcal_per_100g: number;
  protein_g_per_100g: number | null;
  carbs_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  common_unit: string | null;
  common_unit_grams: number | null;
  created_by: string | null;
  created_at: string;
}

export interface MealRow {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  eaten_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface RecipeRow {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  created_at: string;
}

export interface RecipeItemRow {
  id: string;
  recipe_id: string;
  food_id: string | null;
  name: string;
  grams: number | null;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
}

export interface MealItemRow {
  id: string;
  meal_id: string;
  food_id: string | null;
  name: string;
  grams: number | null;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
}

export interface ActivityBlockRow {
  id: string;
  user_id: string;
  date: string;
  start_at: string | null;
  end_at: string | null;
  activity_type: string;
  intensity: string | null;
  duration_min: number;
  met_value: number;
  calories_active: number;
  created_at: string;
}

export interface EngineStateWeeklyRow {
  id: string;
  user_id: string;
  week_start_date: string;
  tdee_prior: number;
  tdee_week_estimate: number;
  tdee_posterior: number;
  alpha: number;
  data_completeness_score: number;
  avg_intake: number;
  delta_weight_kg: number;
  accepted: boolean;
  created_at: string;
}

export interface DailyTargetRow {
  id: string;
  user_id: string;
  date: string;
  target_calories_base: number;
  target_calories_adjusted: number | null;
  planned_training_flag: boolean;
  created_at: string;
}

/**
 * Top-level Supabase `Database` shape — matches what
 * `supabase gen types typescript` would emit, so the client below stays
 * compatible when we switch over. The empty Views/Functions/Enums/
 * CompositeTypes maps are required by supabase-js's generics; without
 * them the typed query builder collapses to `never`.
 */

type TableDef<R, I, U> = {
  Row: R;
  Insert: I;
  Update: U;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<
        ProfileRow,
        Omit<ProfileRow, "created_at" | "updated_at"> & { preferred_units?: ProfileRow["preferred_units"]; timezone?: string },
        Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">>
      >;
      goals: TableDef<
        GoalRow,
        Omit<GoalRow, "id" | "created_at"> & { id?: string; status?: GoalStatus },
        Partial<Omit<GoalRow, "id" | "user_id" | "created_at">>
      >;
      weight_entries: TableDef<
        WeightEntryRow,
        Omit<WeightEntryRow, "id" | "created_at"> & { id?: string; source?: WeightSource; note?: string | null },
        Partial<Omit<WeightEntryRow, "id" | "user_id" | "created_at">>
      >;
      foods: TableDef<
        FoodRow,
        Omit<FoodRow, "id" | "created_at"> & { id?: string },
        Partial<Omit<FoodRow, "id" | "created_at">>
      >;
      meals: TableDef<
        MealRow,
        Omit<MealRow, "id" | "created_at"> & { id?: string },
        Partial<Omit<MealRow, "id" | "user_id" | "created_at">>
      >;
      meal_items: TableDef<
        MealItemRow,
        Omit<MealItemRow, "id" | "created_at"> & { id?: string },
        Partial<Omit<MealItemRow, "id" | "meal_id" | "created_at">>
      >;
      recipes: TableDef<
        RecipeRow,
        Omit<RecipeRow, "id" | "created_at"> & { id?: string },
        Partial<Omit<RecipeRow, "id" | "user_id" | "created_at">>
      >;
      recipe_items: TableDef<
        RecipeItemRow,
        Omit<RecipeItemRow, "id" | "created_at"> & { id?: string },
        Partial<Omit<RecipeItemRow, "id" | "recipe_id" | "created_at">>
      >;
      activity_blocks: TableDef<
        ActivityBlockRow,
        Omit<ActivityBlockRow, "id" | "created_at"> & { id?: string },
        Partial<Omit<ActivityBlockRow, "id" | "user_id" | "created_at">>
      >;
      engine_state_weekly: TableDef<
        EngineStateWeeklyRow,
        Omit<EngineStateWeeklyRow, "id" | "created_at" | "accepted"> & { id?: string; accepted?: boolean },
        Partial<Omit<EngineStateWeeklyRow, "id" | "user_id" | "created_at">>
      >;
      daily_targets: TableDef<
        DailyTargetRow,
        Omit<DailyTargetRow, "id" | "created_at" | "planned_training_flag"> & { id?: string; planned_training_flag?: boolean },
        Partial<Omit<DailyTargetRow, "id" | "user_id" | "created_at">>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
