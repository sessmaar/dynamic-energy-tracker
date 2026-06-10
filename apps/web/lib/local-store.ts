import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ActivityLevel } from "@dynamic-energy/engine";
import type { FoodCandidate } from "@dynamic-energy/data";

export type Sex = "male" | "female";
export type UnitSystem = "metric" | "imperial";
export type GoalType = "cut" | "maintain" | "gain";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "quick_add";

export interface LocalProfile {
  sex: Sex;
  dateOfBirth: string;       // YYYY-MM-DD
  heightCm: number;
  initialWeightKg: number;
  units: UnitSystem;
  timezone: string;
  activityLevel: ActivityLevel;
}

export interface LocalGoal {
  type: GoalType;
  /** magnitude only; sign comes from `type`. */
  rateKgPerWeek: number;
  startDate: string;
  goalWeightKg: number | null;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface LocalWeightEntry {
  id: string;
  date: string;
  weightKg: number;
  note?: string;
}

export interface LocalMealItem {
  name: string;
  grams: number | null;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  foodId?: string;
}

export interface LocalMeal {
  id: string;
  date: string;
  mealType: MealType;
  items: LocalMealItem[];
  notes?: string;
}

export interface LocalActivity {
  id: string;
  date: string;
  activityType: string;
  metValue: number;
  durationMin: number;
  caloriesActive: number;
}

export interface LocalEngineWeek {
  weekStart: string;
  tdeePrior: number;
  tdeeWeek: number;
  tdeePosterior: number;
  alpha: number;
  avgIntake: number;
  deltaWeightKg: number;
  accepted: boolean;
}

export interface LocalState {
  schemaVersion: 1;
  profile: LocalProfile | null;
  goal: LocalGoal | null;
  weights: LocalWeightEntry[];
  meals: LocalMeal[];
  activities: LocalActivity[];
  engineWeeks: LocalEngineWeek[];
  foodsCache: FoodCandidate[];
  geminiApiKey?: string;
}

export const initialLocalState: LocalState = {
  schemaVersion: 1,
  profile: null,
  goal: null,
  weights: [],
  meals: [],
  activities: [],
  engineWeeks: [],
  foodsCache: [],
  geminiApiKey: undefined,
};

interface LocalActions {
  setProfile: (p: LocalProfile) => void;
  setGoal: (g: LocalGoal) => void;
  addWeight: (w: Omit<LocalWeightEntry, "id">) => void;
  deleteWeight: (id: string) => void;
  addMeal: (m: Omit<LocalMeal, "id">) => void;
  deleteMeal: (id: string) => void;
  addActivity: (a: Omit<LocalActivity, "id">) => void;
  deleteActivity: (id: string) => void;
  upsertEngineWeek: (w: LocalEngineWeek) => void;
  cacheFood: (f: FoodCandidate) => void;
  loadState: (s: LocalState) => void;
  setGeminiApiKey: (key: string | undefined) => void;
  reset: () => void;
}

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const useLocalStore = create<LocalState & LocalActions>()(
  persist(
    (set) => ({
      ...initialLocalState,

      setProfile: (profile) => set({ profile }),
      setGoal: (goal) => set({ goal }),

      addWeight: (w) =>
        set((s) => ({ weights: [...s.weights, { ...w, id: newId() }] })),
      deleteWeight: (id) =>
        set((s) => ({ weights: s.weights.filter((w) => w.id !== id) })),

      addMeal: (m) =>
        set((s) => ({ meals: [...s.meals, { ...m, id: newId() }] })),
      deleteMeal: (id) =>
        set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),

      addActivity: (a) =>
        set((s) => ({ activities: [...s.activities, { ...a, id: newId() }] })),
      deleteActivity: (id) =>
        set((s) => ({ activities: s.activities.filter((a) => a.id !== id) })),

      upsertEngineWeek: (week) =>
        set((s) => {
          const others = s.engineWeeks.filter((w) => w.weekStart !== week.weekStart);
          return { engineWeeks: [...others, week].sort((a, b) => a.weekStart.localeCompare(b.weekStart)) };
        }),

      cacheFood: (f) =>
        set((s) => {
          if (s.foodsCache.some((c) => c.sourceRef === f.sourceRef)) return s;
          return { foodsCache: [...s.foodsCache, f].slice(-200) };
        }),

      loadState: (next) => set(next),
      setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
      reset: () => set(initialLocalState),
    }),
    {
      name: "det.personal.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
