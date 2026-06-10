import {
  type ActivityLevel,
  type IntakeEntry,
  type WeightEntry,
  type IsoDate,
  isoDate,
  kcal,
  kg,
} from "@dynamic-energy/engine";
import {
  useLocalStore,
  type LocalMeal,
  type LocalMealItem,
  type LocalProfile,
  type LocalGoal,
  type LocalEngineWeek,
  type MealType,
} from "./local-store";

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const sumNullable = (xs: (number | null)[]): number | null => {
  const ns = xs.filter((n): n is number => n != null);
  return ns.length === 0 ? null : sum(ns);
};

export const localRepos = {
  profile: {
    get(): LocalProfile | null {
      return useLocalStore.getState().profile;
    },
    set(p: LocalProfile): void {
      useLocalStore.getState().setProfile(p);
    },
  },

  goal: {
    get(): LocalGoal | null {
      return useLocalStore.getState().goal;
    },
    set(g: LocalGoal): void {
      useLocalStore.getState().setGoal(g);
    },
  },

  weight: {
    listSince(since: string): WeightEntry[] {
      return useLocalStore
        .getState()
        .weights.filter((w) => w.date >= since)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((w) => ({
          date: isoDate(w.date) as IsoDate,
          weight: kg(w.weightKg),
        }));
    },
    log(input: { date: string; weightKg: number; note?: string }): void {
      useLocalStore.getState().addWeight(input);
    },
  },

  intake: {
    listSince(since: string): IntakeEntry[] {
      const meals = useLocalStore
        .getState()
        .meals.filter((m) => m.date >= since);
      const byDate = new Map<string, LocalMeal[]>();
      for (const m of meals) {
        const arr = byDate.get(m.date) ?? [];
        arr.push(m);
        byDate.set(m.date, arr);
      }
      const out: IntakeEntry[] = [];
      for (const [date, day] of byDate) {
        const items = day.flatMap((m) => m.items);
        out.push({
          date: isoDate(date) as IsoDate,
          calories: kcal(sum(items.map((i) => i.kcal))),
          proteinG: sumNullable(items.map((i: LocalMealItem) => i.proteinG)),
          carbsG: sumNullable(items.map((i: LocalMealItem) => i.carbsG)),
          fatG: sumNullable(items.map((i: LocalMealItem) => i.fatG)),
        });
      }
      out.sort((a, b) => a.date.localeCompare(b.date));
      return out;
    },
  },

  meal: {
    listForDate(date: string) {
      return useLocalStore.getState().meals.filter((m) => m.date === date);
    },
    add(input: {
      date: string;
      mealType: MealType;
      items: LocalMealItem[];
      notes?: string;
    }): void {
      useLocalStore.getState().addMeal(input);
    },
    delete(id: string): void {
      useLocalStore.getState().deleteMeal(id);
    },
  },

  activity: {
    listSince(since: string) {
      return useLocalStore
        .getState()
        .activities.filter((a) => a.date >= since);
    },
    log(input: {
      date: string;
      activityType: string;
      metValue: number;
      durationMin: number;
      caloriesActive: number;
    }): void {
      useLocalStore.getState().addActivity(input);
    },
  },


  coach: {
    getContext(): string {
      const state = useLocalStore.getState();
      const profile = state.profile;
      const goal = state.goal;
      if (!profile || !goal) return "User profile or goal not set.";

      const today = new Date().toISOString().slice(0, 10);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
      const since = sevenDaysAgo.toISOString().slice(0, 10);

      const weights = localRepos.weight.listSince(since);
      const intake = localRepos.intake.listSince(since);

      let context = `User Profile:
- Sex: ${profile.sex}
- Height: ${profile.heightCm} cm
- Activity Level: ${profile.activityLevel}
- Current Goal: ${goal.type} at ${goal.rateKgPerWeek} kg/week
- Target Macros: P ${goal.proteinG}g, C ${goal.carbsG}g, F ${goal.fatG}g

Last 7 days of logs (starting from ${since}):
`;

      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setUTCDate(d.getUTCDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const w = weights.find(w => w.date === dateStr);
        const in_ = intake.find(in_ => in_.date === dateStr);
        
        context += `- ${dateStr}: `;
        if (w) context += `Weight: ${w.weight} kg. `;
        if (in_) context += `Intake: ${in_.calories} kcal (P: ${in_.proteinG}g, C: ${in_.carbsG}g, F: ${in_.fatG}g). `;
        if (!w && !in_) context += `No logs.`;
        context += "\n";
      }

      return context;
    }
  },
  engine: {
    list(): LocalEngineWeek[] {
      return useLocalStore.getState().engineWeeks;
    },
    accept(week: LocalEngineWeek): void {
      useLocalStore.getState().upsertEngineWeek(week);
    },
  },
};

export type LocalActivityLevel = ActivityLevel;
