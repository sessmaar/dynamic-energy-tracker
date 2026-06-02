import {
  type ActivityBlock, type IntakeEntry, type IsoDate, type UserProfile,
  type WeeklyGoal, type WeightEntry,
} from "@dynamic-energy/engine";
import type { DataClient } from "./client";
import {
  accountFromRow, type AccountProfile,
  activityFromRow, foodFromRow, type FoodSummary, goalFromRow,
  goalWithMacrosFromRow, type GoalWithMacros,
  intakeFromRow, mealFromRow, type MealSummary, profileFromRow,
  recipeFromRow, type RecipeSummary, weightFromRow,
} from "./mappers";
import type {
  ActivityBlockRow, DailyIntakeRow, EngineStateWeeklyRow, FoodRow, GoalRow,
  MealItemRow, MealRow, MealType, ProfileRow, RecipeItemRow, RecipeRow,
  Sex, WeightEntryRow,
} from "./schema";
import type { FoodCandidate } from "./openFoodFacts";

/**
 * One repository per table. Methods return engine domain types and take
 * plain JS values — the brand conversion happens entirely inside this
 * package. Mistakes like "I forgot to brand the weight" can't reach the
 * engine because the engine's input types are branded.
 *
 * Each select casts the response through `unknown` to the matching Row
 * type. This is the deliberate type seam between the wire format and
 * the engine vocabulary; everything outside this file stays fully
 * typed.
 */

/** Cast a supabase-js select response (which may be a SelectQueryError on the typed client) to a concrete row array. */
const rows = <T>(data: unknown): T[] => (data as T[] | null) ?? [];
const oneRow = <T>(data: unknown): T | null => (data as T | null);

// ---------- profile -------------------------------------------------------

export const profileRepo = (db: DataClient) => ({
  async get(userId: string): Promise<UserProfile | null> {
    const { data, error } = await db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    const row = oneRow<ProfileRow>(data);
    return row ? profileFromRow(row) : null;
  },

  /** Richer projection — includes timezone, DOB, starting weight. */
  async getAccount(userId: string): Promise<AccountProfile | null> {
    const { data, error } = await db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    const row = oneRow<ProfileRow>(data);
    return row ? accountFromRow(row) : null;
  },

  async upsert(input: {
    userId: string;
    sex: Sex;
    dateOfBirth: string;
    heightCm: number;
    initialWeightKg: number;
    timezone?: string;
  }): Promise<void> {
    const { error } = await db.from("profiles").upsert({
      id: input.userId,
      sex: input.sex,
      date_of_birth: input.dateOfBirth,
      height_cm: input.heightCm,
      initial_weight_kg: input.initialWeightKg,
      timezone: input.timezone ?? "UTC",
      preferred_units: "metric",
    });
    if (error) throw error;
  },

  /**
   * Self-service account deletion via the RPC defined in 0003. Cascades
   * through every user-owned table. Returns nothing; the caller should
   * sign the user out and clear local state.
   */
  async deleteSelf(): Promise<void> {
    const { error } = await db.rpc("delete_self");
    if (error) throw error;
  },
});

// ---------- goal ----------------------------------------------------------

export const goalRepo = (db: DataClient) => ({
  async getActive(userId: string): Promise<WeeklyGoal | null> {
    const { data, error } = await db
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);
    if (error) throw error;
    const list = rows<GoalRow>(data);
    return list.length > 0 ? goalFromRow(list[0]!) : null;
  },

  /** Goal + macro targets in one trip. Macro fields null when unset. */
  async getActiveWithMacros(userId: string): Promise<GoalWithMacros | null> {
    const { data, error } = await db
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);
    if (error) throw error;
    const list = rows<GoalRow>(data);
    return list.length > 0 ? goalWithMacrosFromRow(list[0]!) : null;
  },

  async setActive(input: {
    userId: string;
    goalType: "cut" | "maintain" | "gain";
    rateKgPerWeek: number;
    startDate: IsoDate;
    /** Optional — if omitted, macro target columns stay null. */
    proteinGTarget?: number | null;
    carbsGTarget?: number | null;
    fatGTarget?: number | null;
  }): Promise<void> {
    const demote = await db
      .from("goals")
      .update({ status: "completed" })
      .eq("user_id", input.userId)
      .eq("status", "active");
    if (demote.error) throw demote.error;

    const { error } = await db.from("goals").insert({
      user_id: input.userId,
      goal_type: input.goalType,
      goal_rate_kg_per_week: Math.abs(input.rateKgPerWeek),
      start_date: input.startDate,
      end_date: null,
      status: "active",
      protein_g_target: input.proteinGTarget ?? null,
      carbs_g_target: input.carbsGTarget ?? null,
      fat_g_target: input.fatGTarget ?? null,
    });
    if (error) throw error;
  },

  /** Patch macro targets on the currently active goal without rotating it. */
  async setMacroTargets(userId: string, targets: {
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  }): Promise<void> {
    const { error } = await db
      .from("goals")
      .update({
        protein_g_target: targets.proteinG,
        carbs_g_target: targets.carbsG,
        fat_g_target: targets.fatG,
      })
      .eq("user_id", userId)
      .eq("status", "active");
    if (error) throw error;
  },
});

// ---------- weight --------------------------------------------------------

export const weightRepo = (db: DataClient) => ({
  async listSince(userId: string, sinceDate: IsoDate): Promise<WeightEntry[]> {
    const { data, error } = await db
      .from("weight_entries")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceDate)
      .order("date", { ascending: true });
    if (error) throw error;
    return rows<WeightEntryRow>(data).map(weightFromRow);
  },

  async log(input: { userId: string; date: IsoDate; weightKg: number; note?: string }): Promise<void> {
    const { error } = await db.from("weight_entries").insert({
      user_id: input.userId,
      date: input.date,
      weight_kg: input.weightKg,
      source: "manual",
      note: input.note ?? null,
    });
    if (error) throw error;
  },
});

// ---------- intake --------------------------------------------------------
//
// Reads only — daily totals come from the `v_daily_intake` view which
// aggregates meal_items. To *write* intake, call mealRepo.logMeal (or
// mealRepo.quickAdd for the old "just enter a number" flow).

export const intakeRepo = (db: DataClient) => ({
  async listSince(userId: string, sinceDate: IsoDate): Promise<IntakeEntry[]> {
    const { data, error } = await db
      .from("v_daily_intake")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceDate)
      .order("date", { ascending: true });
    if (error) throw error;
    return rows<DailyIntakeRow>(data).map(intakeFromRow);
  },
});

// ---------- food ----------------------------------------------------------

export const foodRepo = (db: DataClient) => ({
  /** Local catalog search via Postgres trigram index. */
  async searchLocal(query: string, limit = 20): Promise<FoodSummary[]> {
    const { data, error } = await db
      .from("foods")
      .select("*")
      .ilike("name", `%${query}%`)
      .limit(limit);
    if (error) throw error;
    return rows<FoodRow>(data).map(foodFromRow);
  },

  /**
   * Upsert an Open Food Facts (or USDA) result into the local catalog.
   * Idempotent on (source, source_ref). Returns the cached row so the UI
   * can immediately reference its id when building meal items.
   */
  async upsertCandidate(c: FoodCandidate): Promise<FoodSummary> {
    const { data, error } = await db
      .from("foods")
      .upsert(
        {
          source: c.source,
          source_ref: c.sourceRef,
          name: c.name,
          brand: c.brand,
          serving_size_g: c.servingSizeG,
          kcal_per_100g: c.kcalPer100g,
          protein_g_per_100g: c.proteinPer100g,
          carbs_g_per_100g: c.carbsPer100g,
          fat_g_per_100g: c.fatPer100g,
          common_unit: null,
          common_unit_grams: null,
          created_by: null,
        },
        { onConflict: "source,source_ref" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return foodFromRow(data as unknown as FoodRow);
  },

  /**
   * Top N foods this user has logged most often, across their full
   * meal history. Surfaces a "your usual" list when the search box is
   * empty. Joins `meal_items` → `meals` → `foods` to count by food and
   * filter to the calling user; the count column is the single source
   * of truth for "is this a favorite" — no separate favorites table.
   */
  async topUserFoods(userId: string, limit = 8): Promise<FoodSummary[]> {
    const { data: itemsData, error: itemsErr } = await db
      .from("meal_items")
      .select("food_id, meal_id");
    if (itemsErr) throw itemsErr;
    const allItems = rows<{ food_id: string | null; meal_id: string }>(itemsData);

    // Filter to items whose parent meal belongs to this user. RLS already
    // limits both queries to the caller's rows, but doing an explicit
    // join client-side keeps PostgREST happy without a stored view.
    const mealIds = Array.from(new Set(allItems.map((i) => i.meal_id)));
    if (mealIds.length === 0) return [];
    const { data: mealsData, error: mealsErr } = await db
      .from("meals")
      .select("id")
      .eq("user_id", userId)
      .in("id", mealIds);
    if (mealsErr) throw mealsErr;
    const ownMealIds = new Set(rows<{ id: string }>(mealsData).map((m) => m.id));

    const counts = new Map<string, number>();
    for (const it of allItems) {
      if (!it.food_id) continue;
      if (!ownMealIds.has(it.meal_id)) continue;
      counts.set(it.food_id, (counts.get(it.food_id) ?? 0) + 1);
    }
    const topIds = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
    if (topIds.length === 0) return [];

    const { data: foodsData, error: foodsErr } = await db
      .from("foods")
      .select("*")
      .in("id", topIds);
    if (foodsErr) throw foodsErr;
    const foods = rows<FoodRow>(foodsData).map(foodFromRow);
    // Preserve the count-ordered ranking, since `in()` returns unsorted.
    const byId = new Map(foods.map((f) => [f.id, f]));
    return topIds.map((id) => byId.get(id)).filter((f): f is FoodSummary => f !== undefined);
  },

  async createCustom(input: {
    userId: string;
    name: string;
    brand?: string;
    kcalPer100g: number;
    proteinPer100g?: number;
    carbsPer100g?: number;
    fatPer100g?: number;
    commonUnit?: string;
    commonUnitGrams?: number;
  }): Promise<FoodSummary> {
    const { data, error } = await db
      .from("foods")
      .insert({
        source: "custom",
        source_ref: null,
        name: input.name,
        brand: input.brand ?? null,
        serving_size_g: null,
        kcal_per_100g: input.kcalPer100g,
        protein_g_per_100g: input.proteinPer100g ?? null,
        carbs_g_per_100g: input.carbsPer100g ?? null,
        fat_g_per_100g: input.fatPer100g ?? null,
        common_unit: input.commonUnit ?? null,
        common_unit_grams: input.commonUnitGrams ?? null,
        created_by: input.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return foodFromRow(data as unknown as FoodRow);
  },
});

// ---------- meal ----------------------------------------------------------

/**
 * Computed nutrition for `grams` of a food, using the catalog's per-100g
 * values. Centralized here so importers, UI, and tests agree on rounding.
 */
export const computeMealItemNutrition = (
  food: Pick<FoodSummary, "kcalPer100g" | "proteinPer100g" | "carbsPer100g" | "fatPer100g">,
  grams: number,
) => {
  const factor = grams / 100;
  return {
    kcal: Math.round(food.kcalPer100g * factor),
    proteinG: food.proteinPer100g != null ? Number((food.proteinPer100g * factor).toFixed(1)) : null,
    carbsG: food.carbsPer100g != null ? Number((food.carbsPer100g * factor).toFixed(1)) : null,
    fatG: food.fatPer100g != null ? Number((food.fatPer100g * factor).toFixed(1)) : null,
  };
};

export interface NewMealItem {
  /** Optional — null/undefined for ad-hoc "Quick Add" with just name + kcal. */
  foodId?: string;
  name: string;
  grams?: number;
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

export const mealRepo = (db: DataClient) => ({
  /**
   * Insert a meal + its items in two steps. Supabase doesn't expose a
   * single-call nested insert through PostgREST, so we accept the extra
   * round trip rather than introducing a stored procedure.
   */
  async logMeal(input: {
    userId: string;
    date: IsoDate;
    mealType: MealType;
    eatenAt?: string;
    items: NewMealItem[];
    notes?: string;
  }): Promise<string> {
    if (input.items.length === 0) throw new Error("Cannot log a meal with zero items");

    const mealInsert = await db
      .from("meals")
      .insert({
        user_id: input.userId,
        date: input.date,
        meal_type: input.mealType,
        eaten_at: input.eatenAt ?? null,
        notes: input.notes ?? null,
      })
      .select("id")
      .single();
    if (mealInsert.error) throw mealInsert.error;
    const mealId = (mealInsert.data as unknown as { id: string }).id;

    const itemsInsert = await db.from("meal_items").insert(
      input.items.map((i) => ({
        meal_id: mealId,
        food_id: i.foodId ?? null,
        name: i.name,
        grams: i.grams ?? null,
        kcal: Math.round(i.kcal),
        protein_g: i.proteinG ?? null,
        carbs_g: i.carbsG ?? null,
        fat_g: i.fatG ?? null,
      })),
    );
    if (itemsInsert.error) throw itemsInsert.error;
    return mealId;
  },

  /** Shorthand for the legacy "just type a kcal number" path. */
  async quickAdd(input: {
    userId: string;
    date: IsoDate;
    name: string;
    kcal: number;
  }): Promise<string> {
    return this.logMeal({
      userId: input.userId,
      date: input.date,
      mealType: "quick_add",
      items: [{ name: input.name, kcal: input.kcal }],
    });
  },

  /** List meals on a single date with their items, oldest-first. */
  async listForDate(userId: string, date: IsoDate): Promise<MealSummary[]> {
    const mealsRes = await db
      .from("meals")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .order("created_at", { ascending: true });
    if (mealsRes.error) throw mealsRes.error;
    const meals = rows<MealRow>(mealsRes.data);
    if (meals.length === 0) return [];

    const itemsRes = await db
      .from("meal_items")
      .select("*")
      .in("meal_id", meals.map((m) => m.id));
    if (itemsRes.error) throw itemsRes.error;
    const items = rows<MealItemRow>(itemsRes.data);

    const byMeal = new Map<string, MealItemRow[]>();
    for (const it of items) {
      const arr = byMeal.get(it.meal_id) ?? [];
      arr.push(it);
      byMeal.set(it.meal_id, arr);
    }
    return meals.map((m) => mealFromRow(m, byMeal.get(m.id) ?? []));
  },

  async deleteMeal(mealId: string): Promise<void> {
    const { error } = await db.from("meals").delete().eq("id", mealId);
    if (error) throw error;
  },

  /** Fetch a single meal (with items) by id. Returns null if not found. */
  async getMeal(mealId: string): Promise<MealSummary | null> {
    const mealRes = await db.from("meals").select("*").eq("id", mealId).maybeSingle();
    if (mealRes.error) throw mealRes.error;
    const meal = oneRow<MealRow>(mealRes.data);
    if (!meal) return null;
    const itemsRes = await db
      .from("meal_items")
      .select("*")
      .eq("meal_id", mealId)
      .order("created_at", { ascending: true });
    if (itemsRes.error) throw itemsRes.error;
    return mealFromRow(meal, rows<MealItemRow>(itemsRes.data));
  },

  /** Patch a meal_item's portion + recomputed macros. */
  async updateItem(itemId: string, patch: {
    grams?: number;
    kcal?: number;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
  }): Promise<void> {
    const { error } = await db.from("meal_items").update({
      grams: patch.grams ?? null,
      kcal: patch.kcal != null ? Math.round(patch.kcal) : undefined,
      protein_g: patch.proteinG ?? null,
      carbs_g: patch.carbsG ?? null,
      fat_g: patch.fatG ?? null,
    }).eq("id", itemId);
    if (error) throw error;
  },

  async deleteItem(itemId: string): Promise<void> {
    const { error } = await db.from("meal_items").delete().eq("id", itemId);
    if (error) throw error;
  },
});

// ---------- activity ------------------------------------------------------

export const activityRepo = (db: DataClient) => ({
  async listSince(userId: string, sinceDate: IsoDate): Promise<ActivityBlock[]> {
    const { data, error } = await db
      .from("activity_blocks")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceDate)
      .order("date", { ascending: true });
    if (error) throw error;
    return rows<ActivityBlockRow>(data).map(activityFromRow);
  },

  async log(input: {
    userId: string;
    date: IsoDate;
    activityType: string;
    metValue: number;
    durationMin: number;
    caloriesActive: number;
    intensity?: string;
  }): Promise<void> {
    const { error } = await db.from("activity_blocks").insert({
      user_id: input.userId,
      date: input.date,
      activity_type: input.activityType,
      met_value: input.metValue,
      duration_min: input.durationMin,
      calories_active: Math.round(input.caloriesActive),
      intensity: input.intensity ?? null,
      start_at: null,
      end_at: null,
    });
    if (error) throw error;
  },
});

// ---------- recipe -------------------------------------------------------

export const recipeRepo = (db: DataClient) => ({
  async list(userId: string): Promise<RecipeSummary[]> {
    const recRes = await db
      .from("recipes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (recRes.error) throw recRes.error;
    const recs = rows<RecipeRow>(recRes.data);
    if (recs.length === 0) return [];

    const itemsRes = await db
      .from("recipe_items")
      .select("*")
      .in("recipe_id", recs.map((r) => r.id));
    if (itemsRes.error) throw itemsRes.error;
    const items = rows<RecipeItemRow>(itemsRes.data);
    const byRecipe = new Map<string, RecipeItemRow[]>();
    for (const it of items) {
      const arr = byRecipe.get(it.recipe_id) ?? [];
      arr.push(it);
      byRecipe.set(it.recipe_id, arr);
    }
    return recs.map((r) => recipeFromRow(r, byRecipe.get(r.id) ?? []));
  },

  async get(recipeId: string): Promise<RecipeSummary | null> {
    const recRes = await db.from("recipes").select("*").eq("id", recipeId).maybeSingle();
    if (recRes.error) throw recRes.error;
    const rec = oneRow<RecipeRow>(recRes.data);
    if (!rec) return null;
    const itemsRes = await db.from("recipe_items").select("*").eq("recipe_id", recipeId);
    if (itemsRes.error) throw itemsRes.error;
    return recipeFromRow(rec, rows<RecipeItemRow>(itemsRes.data));
  },

  /**
   * Create a recipe with items in two calls (PostgREST doesn't expose
   * nested inserts through the typed builder). Same trade-off as mealRepo.logMeal.
   */
  async create(input: {
    userId: string;
    name: string;
    notes?: string;
    items: Array<{
      foodId?: string | null;
      name: string;
      grams?: number | null;
      kcal: number;
      proteinG?: number | null;
      carbsG?: number | null;
      fatG?: number | null;
    }>;
  }): Promise<string> {
    if (input.items.length === 0) throw new Error("Recipe must have ≥1 item");
    const rec = await db.from("recipes").insert({
      user_id: input.userId,
      name: input.name,
      notes: input.notes ?? null,
    }).select("id").single();
    if (rec.error) throw rec.error;
    const recipeId = (rec.data as unknown as { id: string }).id;
    const itemsRes = await db.from("recipe_items").insert(
      input.items.map((i) => ({
        recipe_id: recipeId,
        food_id: i.foodId ?? null,
        name: i.name,
        grams: i.grams ?? null,
        kcal: Math.round(i.kcal),
        protein_g: i.proteinG ?? null,
        carbs_g: i.carbsG ?? null,
        fat_g: i.fatG ?? null,
      })),
    );
    if (itemsRes.error) throw itemsRes.error;
    return recipeId;
  },

  async delete(recipeId: string): Promise<void> {
    const { error } = await db.from("recipes").delete().eq("id", recipeId);
    if (error) throw error;
  },
});

// ---------- engine state (weekly Bayesian audit) -------------------------

export const engineStateRepo = (db: DataClient) => ({
  async upsertWeek(input: {
    userId: string;
    weekStart: IsoDate;
    tdeePrior: number;
    tdeeWeek: number;
    tdeePosterior: number;
    alpha: number;
    completeness: number;
    avgIntake: number;
    deltaWeightKg: number;
    accepted: boolean;
  }): Promise<void> {
    const { error } = await db.from("engine_state_weekly").upsert(
      {
        user_id: input.userId,
        week_start_date: input.weekStart,
        tdee_prior: input.tdeePrior,
        tdee_week_estimate: input.tdeeWeek,
        tdee_posterior: input.tdeePosterior,
        alpha: input.alpha,
        data_completeness_score: input.completeness,
        avg_intake: input.avgIntake,
        delta_weight_kg: input.deltaWeightKg,
        accepted: input.accepted,
      },
      { onConflict: "user_id,week_start_date" },
    );
    if (error) throw error;
  },

  async latest(userId: string): Promise<number | null> {
    const { data, error } = await db
      .from("engine_state_weekly")
      .select("tdee_posterior")
      .eq("user_id", userId)
      .order("week_start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const row = oneRow<{ tdee_posterior: number }>(data);
    return row?.tdee_posterior ?? null;
  },

  /**
   * Newest-first list of accepted weekly check-ins. Powers the
   * Convergence screen's audit history table.
   */
  async listHistory(userId: string, limit = 12): Promise<EngineStateWeeklyRow[]> {
    const { data, error } = await db
      .from("engine_state_weekly")
      .select("*")
      .eq("user_id", userId)
      .order("week_start_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return rows<EngineStateWeeklyRow>(data);
  },
});

// ---------- aggregate convenience ----------------------------------------

/**
 * Pre-built repository bundle. Lets callers do:
 *   const repos = repositories(client);
 *   const profile = await repos.profile.get(userId);
 */
export const repositories = (db: DataClient) => ({
  profile:     profileRepo(db),
  goal:        goalRepo(db),
  weight:      weightRepo(db),
  intake:      intakeRepo(db),
  food:        foodRepo(db),
  meal:        mealRepo(db),
  recipe:      recipeRepo(db),
  activity:    activityRepo(db),
  engineState: engineStateRepo(db),
});

export type Repositories = ReturnType<typeof repositories>;
