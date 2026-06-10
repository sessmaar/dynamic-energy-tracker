# Personal PWA — localStorage-backed Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the deployed Next.js web app into a personal-use PWA backed entirely by `localStorage` — no auth, no Supabase, no accounts — so it can be added to the home screen and used on the go.

**Architecture:** A thin zustand store with `persist` middleware owns one typed `LocalState` keyed in localStorage. A `localRepos` module exposes methods shaped like the existing Supabase repos so existing pages rewire with minimal change. The pure scientific onboarding logic (assessment reducer / plan computation / validation / persistence builder) is copied verbatim from the abandoned mobile branch (it has no React Native dependencies). All target math runs through `@dynamic-energy/engine`. The Clarity palette is applied to `apps/web/app/tokens.css`. Existing pages (`/dashboard`, `/log-meal`, `/log-weight`, `/convergence`) are rewired to `localRepos`; auth-dependent routes (`/sign-in`, `/auth/callback`, `middleware.ts`) are removed.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4 (already wired), zustand 5 (new dep), `@dynamic-energy/engine`, `@dynamic-energy/data` (kept for `searchOpenFoodFacts`, `parseMfpCsv`, `FoodCandidate`, `computeMealItemNutrition`, `type` exports only — no repos), Vercel deploy. Vitest already exists in `packages/engine` and `packages/data` for the imported logic.

**Scope note:** This is a single-deliverable plan. After it ships you will have a usable personal tracker. Body composition logging, weekly Bayesian check-in UI polish, recipes, and barcode scanning are explicit follow-ups, not in this plan.

---

## File Structure

**Create:**
- `apps/web/lib/local-store.ts` — typed `LocalState` shape + zustand store + localStorage persistence
- `apps/web/lib/local-repos.ts` — repo-shaped API surface backed by the store
- `apps/web/lib/onboarding/assessment.ts` — copied from the closed mobile branch (pure TS)
- `apps/web/lib/onboarding/plan.ts` — copied from the closed mobile branch (pure TS)
- `apps/web/lib/onboarding/validation.ts` — copied from the closed mobile branch (pure TS)
- `apps/web/lib/onboarding/persistence.ts` — adapted: builds a `LocalState` patch (not a Supabase write)
- `apps/web/lib/onboarding/__tests__/assessment.test.ts` — copied tests
- `apps/web/lib/onboarding/__tests__/plan.test.ts` — copied tests
- `apps/web/lib/onboarding/__tests__/validation.test.ts` — copied tests
- `apps/web/lib/onboarding/__tests__/persistence.test.ts` — adapted tests
- `apps/web/vitest.config.ts` — vitest config for the web app
- `apps/web/app/today/page.tsx` — new home (replaces `/dashboard` as the canonical home)
- `apps/web/app/log-activity/page.tsx` — new
- `apps/web/app/profile/page.tsx` — new (edit goal, units, export/import)
- `apps/web/components/TabBar.tsx` — bottom tab bar shell

**Modify:**
- `apps/web/package.json` — add zustand + vitest devDep + `test` script
- `apps/web/app/tokens.css` — Clarity palette (light only for now; dark in a follow-up)
- `apps/web/app/layout.tsx` — keep, but remove any auth references
- `apps/web/app/page.tsx` — replace demo landing with a router that goes to `/today` or `/onboarding`
- `apps/web/app/onboard/page.tsx` — rename route to `/onboarding` (move file) and replace with the multi-step scientific assessment
- `apps/web/app/log-meal/page.tsx` — rewire to `localRepos` (drop session checks)
- `apps/web/app/log-weight/page.tsx` — rewire to `localRepos`
- `apps/web/app/dashboard/page.tsx` — rewire to `localRepos`; later we'll point `/today` here, then delete the dashboard route
- `apps/web/app/convergence/page.tsx` — rewire to `localRepos` (rename UI to "Coach")
- `apps/web/app/import/page.tsx` — rewire to `localRepos`
- `apps/web/public/manifest.json` — adjust app name, start_url
- `apps/web/vercel.json` — keep security headers (no changes needed)

**Delete:**
- `apps/web/middleware.ts` — no auth means no gate
- `apps/web/app/sign-in/page.tsx` and the `sign-in` directory
- `apps/web/app/auth/callback/page.tsx` and the `auth` directory
- `apps/web/lib/supabase.ts` — no Supabase client
- `apps/web/app/demo/page.tsx` — superseded by the live data

---

## Task 1: Add zustand + vitest to the web app

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: Edit `apps/web/package.json`**

In `"scripts"` add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

In `"dependencies"` add:
```json
    "zustand": "^5.0.2",
```

In `"devDependencies"` add:
```json
    "vitest": "^4.1.8",
```

Remove `@supabase/supabase-js` from `"dependencies"` — it is no longer used. Keep `@dynamic-energy/data` (used for OFF search, MFP importer, and type-only imports).

- [ ] **Step 2: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/__tests__/**/*.test.ts"],
    environment: "jsdom",
  },
});
```

Then ensure `jsdom` is installed; if it's not present add `"jsdom": "^25.0.1"` to `devDependencies` too.

- [ ] **Step 3: Install + verify**

Run from the repo root: `npm install`
Then: `cd apps/web && npx vitest --version`
Expected: 4.x version string.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts package-lock.json
git commit -m "build(web): add zustand + vitest, drop @supabase/supabase-js"
```

---

## Task 2: Apply the Clarity palette to web tokens

The values match the mobile Clarity light palette so the web feels coherent with the design language we already chose.

**Files:**
- Modify: `apps/web/app/tokens.css`

- [ ] **Step 1: Replace the contents of `apps/web/app/tokens.css` with**

```css
:root {
  /* Clarity light — warm neutrals + one confident accent */
  --bg:                  #FBFAF8;
  --surface:             #FFFFFF;
  --surface-container-lowest: #FFFFFF;
  --surface-container-low:    #F6F5F1;
  --surface-container:        #F2F1ED;
  --surface-container-high:   #EAE8E2;
  --surface-container-highest:#E6E4DE;
  --fg:                  #1A1A18;
  --muted:               #6B6A66;
  --border:              #E6E4DE;
  --accent:              #3B5BDB;
  --secondary:           #2F9E44;
  --secondary-container: #51CF66;

  --accent-soft:         rgba(59, 91, 219, 0.10);
  --accent-glow:         rgba(59, 91, 219, 0.18);
  --fg-soft:             rgba(26, 26, 24, 0.06);

  /* Data-viz */
  --viz-calories:        #3B5BDB;
  --viz-protein:         #E8590C;
  --viz-carbs:           #2F9E44;
  --viz-fat:             #F08C00;
  --viz-warning:         #F08C00;
  --viz-error:           #E03131;

  --font-display:        var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
  --font-body:           var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  --font-mono:           var(--font-geist-mono), 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace;

  --fs-h1:               clamp(36px, 5vw, 56px);
  --fs-h2:               clamp(24px, 3.5vw, 32px);
  --fs-h3:               20px;
  --fs-lead:             16px;
  --fs-body:             14px;
  --fs-meta:             11px;
  --fs-bignum:           clamp(32px, 5vw, 48px);

  --radius:              12px;
  --radius-card:         16px;
  --hairline:            1px solid var(--border);

  --gap-xs:              4px;
  --gap-sm:              8px;
  --gap-md:              16px;
  --gap-lg:              24px;
  --gap-xl:              40px;
  --container:           1080px;
}
```

- [ ] **Step 2: Build the web app to confirm CSS parses**

Run: `cd apps/web && npm run build 2>&1 | tail -10`
Expected: build succeeds (or fails on a Supabase import we haven't removed yet — that's fine, the CSS itself parses; if the only failures are about `@/lib/supabase`, ignore them for now).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/tokens.css
git commit -m "feat(web): apply Clarity light palette to tokens.css"
```

---

## Task 3: Delete auth-dependent routes and files

**Files:**
- Delete: `apps/web/middleware.ts`
- Delete: `apps/web/app/sign-in/` (entire directory)
- Delete: `apps/web/app/auth/` (entire directory)
- Delete: `apps/web/lib/supabase.ts`
- Delete: `apps/web/app/demo/page.tsx`

- [ ] **Step 1: Remove the files and directories**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
rm apps/web/middleware.ts
rm -rf apps/web/app/sign-in
rm -rf apps/web/app/auth
rm apps/web/lib/supabase.ts
rm -rf apps/web/app/demo
```

- [ ] **Step 2: Verify nothing else imports the deleted modules (besides pages we'll rewire in later tasks)**

Run: `cd apps/web && grep -rn '@/lib/supabase\|@supabase/supabase-js' app components lib 2>&1 | grep -v node_modules`
Expected: lists `dashboard/page.tsx`, `log-meal/page.tsx`, `log-weight/page.tsx`, `convergence/page.tsx`, `onboard/page.tsx`, `import/page.tsx`. **Those are the files we rewire later.** Any *other* hit means we missed a deletion — fix it.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(web): remove auth-dependent routes, Supabase client, demo page"
```

---

## Task 4: Local store (zustand + persist) (TDD)

The single source of truth for everything: profile, goal, weights, meals, activities, accepted engine weeks. Persisted to localStorage under one key with schema versioning. Pure TypeScript — testable in jsdom.

**Files:**
- Create: `apps/web/lib/local-store.ts`
- Test: `apps/web/lib/__tests__/local-store.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/lib/__tests__/local-store.test.ts`:
```ts
import { describe, expect, it, beforeEach } from "vitest";
import { useLocalStore, initialLocalState, type LocalProfile } from "../local-store";

const profile: LocalProfile = {
  sex: "male",
  dateOfBirth: "1990-01-01",
  heightCm: 180,
  initialWeightKg: 80,
  units: "metric",
  timezone: "UTC",
  activityLevel: "moderate",
};

describe("useLocalStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useLocalStore.setState(initialLocalState);
  });

  it("starts empty", () => {
    expect(useLocalStore.getState().profile).toBeNull();
    expect(useLocalStore.getState().weights).toEqual([]);
  });

  it("setProfile persists the profile", () => {
    useLocalStore.getState().setProfile(profile);
    expect(useLocalStore.getState().profile).toEqual(profile);
  });

  it("addWeight appends a weight entry", () => {
    useLocalStore.getState().addWeight({ date: "2026-06-01", weightKg: 80 });
    const ws = useLocalStore.getState().weights;
    expect(ws).toHaveLength(1);
    expect(ws[0]!.weightKg).toBe(80);
    expect(ws[0]!.id).toBeTruthy();
  });

  it("addMeal appends a meal", () => {
    useLocalStore.getState().addMeal({
      date: "2026-06-01",
      mealType: "lunch",
      items: [{ name: "Oats", grams: 50, kcal: 180, proteinG: 6, carbsG: 32, fatG: 3 }],
    });
    const meals = useLocalStore.getState().meals;
    expect(meals).toHaveLength(1);
    expect(meals[0]!.items[0]!.kcal).toBe(180);
  });

  it("reset clears everything", () => {
    useLocalStore.getState().setProfile(profile);
    useLocalStore.getState().reset();
    expect(useLocalStore.getState().profile).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && npx vitest run lib/__tests__/local-store.test.ts`
Expected: FAIL — cannot find module `../local-store`.

- [ ] **Step 3: Implement `apps/web/lib/local-store.ts`**

```ts
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
      reset: () => set(initialLocalState),
    }),
    {
      name: "det.personal.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && npx vitest run lib/__tests__/local-store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/local-store.ts apps/web/lib/__tests__/local-store.test.ts
git commit -m "feat(web): local zustand store + localStorage persistence"
```

---

## Task 5: Local repos (engine-shaped read API) (TDD)

Existing pages call `repos.weight.listSince(...)`, `repos.intake.listSince(...)` etc. and get back engine-typed arrays. This module exposes the same shape but reads from the local store, so pages rewire by changing imports + dropping session checks. Branding happens here (kg/cm/kcal/IsoDate via the engine helpers).

**Files:**
- Create: `apps/web/lib/local-repos.ts`
- Test: `apps/web/lib/__tests__/local-repos.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/lib/__tests__/local-repos.test.ts`:
```ts
import { describe, expect, it, beforeEach } from "vitest";
import { useLocalStore, initialLocalState } from "../local-store";
import { localRepos } from "../local-repos";

beforeEach(() => {
  localStorage.clear();
  useLocalStore.setState(initialLocalState);
});

describe("localRepos.weight.listSince", () => {
  it("returns engine-typed weights since the given date, sorted ascending", () => {
    useLocalStore.getState().addWeight({ date: "2026-06-01", weightKg: 80 });
    useLocalStore.getState().addWeight({ date: "2026-05-20", weightKg: 81 });
    const ws = localRepos.weight.listSince("2026-05-25");
    expect(ws).toHaveLength(1);
    expect(ws[0]!.weight).toBe(80);
  });
});

describe("localRepos.intake.listSince", () => {
  it("aggregates meal items per date into intake entries", () => {
    const s = useLocalStore.getState();
    s.addMeal({ date: "2026-06-01", mealType: "lunch", items: [{ name: "A", grams: 100, kcal: 300, proteinG: 20, carbsG: 30, fatG: 10 }] });
    s.addMeal({ date: "2026-06-01", mealType: "dinner", items: [{ name: "B", grams: 200, kcal: 500, proteinG: 30, carbsG: 50, fatG: 15 }] });
    s.addMeal({ date: "2026-05-30", mealType: "breakfast", items: [{ name: "C", grams: 50, kcal: 200, proteinG: 5, carbsG: 30, fatG: 5 }] });

    const intake = localRepos.intake.listSince("2026-05-31");
    expect(intake).toHaveLength(1);
    expect(intake[0]!.date).toBe("2026-06-01");
    expect(intake[0]!.calories).toBe(800);
    expect(intake[0]!.proteinG).toBe(50);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && npx vitest run lib/__tests__/local-repos.test.ts`
Expected: FAIL — cannot find module `../local-repos`.

- [ ] **Step 3: Implement `apps/web/lib/local-repos.ts`**

```ts
import {
  type ActivityLevel, type IntakeEntry, type WeightEntry, type IsoDate,
  isoDate, kcal, kg,
} from "@dynamic-energy/engine";
import { useLocalStore, type LocalMeal, type LocalMealItem, type LocalProfile, type LocalGoal } from "./local-store";

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const sumNullable = (xs: (number | null)[]): number | null => {
  const ns = xs.filter((n): n is number => n != null);
  return ns.length === 0 ? null : sum(ns);
};

export const localRepos = {
  profile: {
    get(): LocalProfile | null { return useLocalStore.getState().profile; },
    set(p: LocalProfile): void { useLocalStore.getState().setProfile(p); },
  },

  goal: {
    get(): LocalGoal | null { return useLocalStore.getState().goal; },
    set(g: LocalGoal): void { useLocalStore.getState().setGoal(g); },
  },

  weight: {
    listSince(since: string): WeightEntry[] {
      return useLocalStore.getState().weights
        .filter((w) => w.date >= since)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((w) => ({ date: isoDate(w.date) as IsoDate, weight: kg(w.weightKg) }));
    },
    log(input: { date: string; weightKg: number; note?: string }): void {
      useLocalStore.getState().addWeight(input);
    },
  },

  intake: {
    listSince(since: string): IntakeEntry[] {
      const meals = useLocalStore.getState().meals.filter((m) => m.date >= since);
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
    add(input: { date: string; mealType: LocalMeal["mealType"]; items: LocalMealItem[]; notes?: string }): void {
      useLocalStore.getState().addMeal(input);
    },
    delete(id: string): void {
      useLocalStore.getState().deleteMeal(id);
    },
  },

  activity: {
    listSince(since: string) {
      return useLocalStore.getState().activities.filter((a) => a.date >= since);
    },
    log(input: { date: string; activityType: string; metValue: number; durationMin: number; caloriesActive: number }): void {
      useLocalStore.getState().addActivity(input);
    },
  },

  engine: {
    list() { return useLocalStore.getState().engineWeeks; },
    accept(week: Parameters<typeof useLocalStore.getState extends () => infer S ? S extends { upsertEngineWeek: (w: infer W) => void } ? W : never : never>[0]): void {
      useLocalStore.getState().upsertEngineWeek(week);
    },
  },
};

export type LocalActivityLevel = ActivityLevel;
```

NOTE: the `engine.accept` parameter type is auto-inferred from the store. If TS complains about the inference (it sometimes does with deep utility types), replace its signature with:
```ts
    accept(week: Parameters<ReturnType<typeof useLocalStore.getState>["upsertEngineWeek"]>[0]): void {
      useLocalStore.getState().upsertEngineWeek(week);
    },
```
Test will confirm either form works.

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && npx vitest run lib/__tests__/local-repos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/local-repos.ts apps/web/lib/__tests__/local-repos.test.ts
git commit -m "feat(web): local repos (engine-shaped reads from the store)"
```

---

## Task 6: Onboarding logic — copy assessment/plan/validation from the closed branch

These files are pure TypeScript with no React Native dependencies, so they port to the web app unchanged except for one import path.

**Files:**
- Create: `apps/web/lib/onboarding/assessment.ts`
- Create: `apps/web/lib/onboarding/plan.ts`
- Create: `apps/web/lib/onboarding/validation.ts`
- Create: `apps/web/lib/onboarding/__tests__/assessment.test.ts`
- Create: `apps/web/lib/onboarding/__tests__/plan.test.ts`
- Create: `apps/web/lib/onboarding/__tests__/validation.test.ts`

- [ ] **Step 1: Recover the three files from the closed branch on origin**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
mkdir -p apps/web/lib/onboarding/__tests__
git show origin/feat/clarity-onboarding:apps/mobile/src/onboarding/assessment.ts > apps/web/lib/onboarding/assessment.ts
git show origin/feat/clarity-onboarding:apps/mobile/src/onboarding/plan.ts > apps/web/lib/onboarding/plan.ts
git show origin/feat/clarity-onboarding:apps/mobile/src/onboarding/validation.ts > apps/web/lib/onboarding/validation.ts
git show origin/feat/clarity-onboarding:apps/mobile/src/onboarding/assessment.test.ts > apps/web/lib/onboarding/__tests__/assessment.test.ts
git show origin/feat/clarity-onboarding:apps/mobile/src/onboarding/plan.test.ts > apps/web/lib/onboarding/__tests__/plan.test.ts
git show origin/feat/clarity-onboarding:apps/mobile/src/onboarding/validation.test.ts > apps/web/lib/onboarding/__tests__/validation.test.ts
```

- [ ] **Step 2: Fix import paths in the test files**

Each test currently imports from `"./assessment"`. In the new home (`lib/onboarding/__tests__/`), the modules are one directory up. Update:

In `apps/web/lib/onboarding/__tests__/assessment.test.ts`, change:
```ts
import { assessmentReducer, initialAssessment, type Assessment } from "./assessment";
```
to:
```ts
import { assessmentReducer, initialAssessment, type Assessment } from "../assessment";
```

In `apps/web/lib/onboarding/__tests__/plan.test.ts`, change:
```ts
import { computeStartingPlan } from "./plan";
import { initialAssessment, type Assessment } from "./assessment";
```
to:
```ts
import { computeStartingPlan } from "../plan";
import { initialAssessment, type Assessment } from "../assessment";
```

In `apps/web/lib/onboarding/__tests__/validation.test.ts`, change:
```ts
import { isStepValid } from "./validation";
import { initialAssessment, type Assessment } from "./assessment";
```
to:
```ts
import { isStepValid } from "../validation";
import { initialAssessment, type Assessment } from "../assessment";
```

- [ ] **Step 3: Run the tests**

Run: `cd apps/web && npx vitest run lib/onboarding`
Expected: PASS — 14 tests total (assessment 4 + plan 6 + validation 4 — actually validation has more sub-tests; whatever count you get, all should pass).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/onboarding/
git commit -m "feat(web): port onboarding logic (assessment/plan/validation) from closed branch"
```

---

## Task 7: Persistence builder — write to the local store (TDD)

The mobile version of `persistence.ts` built a Supabase write payload. The web version builds a *function* that applies the assessment to the local store: set profile, set goal (with macro targets), seed initial weight entry.

**Files:**
- Create: `apps/web/lib/onboarding/persistence.ts`
- Create: `apps/web/lib/onboarding/__tests__/persistence.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/lib/onboarding/__tests__/persistence.test.ts`:
```ts
import { describe, expect, it, beforeEach } from "vitest";
import { useLocalStore, initialLocalState } from "../../local-store";
import { initialAssessment, type Assessment } from "../assessment";
import { commitOnboarding } from "../persistence";

const a: Assessment = {
  ...initialAssessment,
  sex: "male",
  dateOfBirth: "1990-01-01",
  heightCm: 180,
  currentWeightKg: 80,
  activityLevel: "moderate",
  goalType: "cut",
  rateKgPerWeek: 0.5,
};

beforeEach(() => {
  localStorage.clear();
  useLocalStore.setState(initialLocalState);
});

describe("commitOnboarding", () => {
  it("writes profile to the store with the device timezone", () => {
    commitOnboarding(a, "America/New_York", "2026-06-03");
    const profile = useLocalStore.getState().profile;
    expect(profile).not.toBeNull();
    expect(profile!.sex).toBe("male");
    expect(profile!.heightCm).toBe(180);
    expect(profile!.initialWeightKg).toBe(80);
    expect(profile!.timezone).toBe("America/New_York");
  });

  it("writes goal with positive magnitude and macro targets", () => {
    commitOnboarding(a, "UTC", "2026-06-03");
    const g = useLocalStore.getState().goal;
    expect(g).not.toBeNull();
    expect(g!.type).toBe("cut");
    expect(g!.rateKgPerWeek).toBeGreaterThan(0); // magnitude
    expect(g!.proteinG).toBeGreaterThan(0);
    expect(g!.startDate).toBe("2026-06-03");
  });

  it("seeds the initial weight entry on the given date", () => {
    commitOnboarding(a, "UTC", "2026-06-03");
    const ws = useLocalStore.getState().weights;
    expect(ws).toHaveLength(1);
    expect(ws[0]!.date).toBe("2026-06-03");
    expect(ws[0]!.weightKg).toBe(80);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && npx vitest run lib/onboarding/__tests__/persistence.test.ts`
Expected: FAIL — cannot find module `../persistence`.

- [ ] **Step 3: Implement `apps/web/lib/onboarding/persistence.ts`**

```ts
import { type Assessment } from "./assessment";
import { computeStartingPlan } from "./plan";
import { useLocalStore } from "../local-store";

/**
 * Apply an onboarding assessment to the local store: set profile,
 * set goal (with macro targets from the engine), seed the initial
 * weight entry. `today` is an ISO YYYY-MM-DD; `timezone` is the
 * IANA timezone the profile will live in.
 */
export const commitOnboarding = (
  a: Assessment,
  timezone: string,
  today: string,
): void => {
  const plan = computeStartingPlan(a, today);
  const s = useLocalStore.getState();

  s.setProfile({
    sex: a.sex,
    dateOfBirth: a.dateOfBirth,
    heightCm: a.heightCm,
    initialWeightKg: a.currentWeightKg,
    units: a.units,
    timezone,
    activityLevel: a.activityLevel,
  });

  s.setGoal({
    type: a.goalType,
    rateKgPerWeek: Math.abs(a.rateKgPerWeek),
    startDate: today,
    goalWeightKg: a.goalWeightKg,
    proteinG: plan.macros.proteinG,
    carbsG: plan.macros.carbsG,
    fatG: plan.macros.fatG,
  });

  s.addWeight({
    date: today,
    weightKg: a.currentWeightKg,
    note: "Initial weight (onboarding)",
  });
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && npx vitest run lib/onboarding/__tests__/persistence.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/onboarding/persistence.ts apps/web/lib/onboarding/__tests__/persistence.test.ts
git commit -m "feat(web): onboarding persistence — apply assessment to local store"
```

---

## Task 8: Onboarding UI — multi-step page

Replace the existing `/onboard` route with `/onboarding` and build the multi-step assessment UI in React. Mirrors the structure of the mobile flow but uses the existing web design utility classes (`glass-card`, `meta`, `eyebrow`, `h2`, `input-minimal`, etc. defined in `apps/web/app/globals.css`) wherever possible.

**Files:**
- Delete: `apps/web/app/onboard/` (old single-step Supabase onboarding)
- Create: `apps/web/app/onboarding/page.tsx`

- [ ] **Step 1: Remove the old onboard route**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
rm -rf apps/web/app/onboard
```

- [ ] **Step 2: Create `apps/web/app/onboarding/page.tsx`**

```tsx
"use client";

import { useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { ACTIVITY_LEVELS, localDateInTimezone } from "@dynamic-energy/engine";
import { assessmentReducer, initialAssessment, type Assessment, type AssessmentAction, type BodyCompMethod, type DietPattern } from "@/lib/onboarding/assessment";
import { isStepValid, type StepId } from "@/lib/onboarding/validation";
import { computeStartingPlan } from "@/lib/onboarding/plan";
import { commitOnboarding } from "@/lib/onboarding/persistence";

const ORDER: StepId[] = ["welcome", "aboutYou", "bodyComp", "activity", "goal", "diet", "reminders", "plan"];

export default function OnboardingPage() {
  const router = useRouter();
  const [a, dispatch] = useReducer(assessmentReducer, initialAssessment);
  const [index, setIndex] = useState(0);
  const step = ORDER[index]!;
  const canAdvance = isStepValid(step, a);
  const isLast = index === ORDER.length - 1;

  const tz = useMemo(
    () => Intl?.DateTimeFormat?.().resolvedOptions().timeZone ?? "UTC",
    [],
  );

  const onNext = () => {
    if (!canAdvance) return;
    if (!isLast) { setIndex((i) => i + 1); return; }
    const today = localDateInTimezone(tz);
    commitOnboarding(a, tz, today);
    router.replace("/today");
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <ProgressBar step={index + 1} total={ORDER.length} />
        {step === "welcome" && <StepWelcome />}
        {step === "aboutYou" && <StepAboutYou a={a} dispatch={dispatch} />}
        {step === "bodyComp" && <StepBodyComp a={a} dispatch={dispatch} />}
        {step === "activity" && <StepActivity a={a} dispatch={dispatch} />}
        {step === "goal" && <StepGoal a={a} dispatch={dispatch} />}
        {step === "diet" && <StepDiet a={a} dispatch={dispatch} />}
        {step === "reminders" && <StepReminders />}
        {step === "plan" && <StepPlan a={a} today={localDateInTimezone(tz)} />}
        <div style={{ display: "flex", gap: 8 }}>
          {index > 0 && <button onClick={() => setIndex((i) => i - 1)} style={btnGhost}>Back</button>}
          <button onClick={onNext} disabled={!canAdvance} style={{ ...btnPrimary, opacity: canAdvance ? 1 : 0.4 }}>
            {isLast ? "Start tracking →" : "Continue"}
          </button>
        </div>
      </div>
    </main>
  );
}

const ProgressBar = ({ step, total }: { step: number; total: number }) => (
  <div style={{ height: 4, background: "var(--surface-container)", borderRadius: 999, overflow: "hidden" }}>
    <div style={{ height: 4, width: `${Math.round((step / total) * 100)}%`, background: "var(--accent)", borderRadius: 999 }} />
  </div>
);

const Header = ({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>{eyebrow}</span>
    <h1 style={{ color: "var(--fg)", fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>{title}</h1>
    {subtitle && <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.5, margin: 0 }}>{subtitle}</p>}
  </div>
);

const Field = ({ label, value, onChange, unit, type = "text" }: { label: string; value: string; onChange: (v: string) => void; unit?: string; type?: "text" | "number" | "date" }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>{label}</span>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, border: 0, outline: 0, background: "transparent", color: "var(--fg)", fontSize: 24, fontWeight: 700, padding: 0 }} />
      {unit && <span style={{ color: "var(--muted)", fontSize: 14, fontWeight: 600 }}>{unit}</span>}
    </div>
  </label>
);

const Segment = <T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) => (
  <div style={{ display: "flex", background: "var(--surface-container)", borderRadius: 12, padding: 4 }}>
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button key={o.value} onClick={() => onChange(o.value)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: 0, background: active ? "var(--surface)" : "transparent", color: active ? "var(--fg)" : "var(--muted)", fontSize: 14, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
          {o.label}
        </button>
      );
    })}
  </div>
);

const SelectableRow = ({ title, detail, trailing, selected, onClick }: { title: string; detail?: string; trailing?: string; selected: boolean; onClick: () => void }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: 16, borderRadius: 14, border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
    background: selected ? "var(--accent-soft)" : "var(--surface)", textAlign: "left", cursor: "pointer", width: "100%",
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ color: selected ? "var(--accent)" : "var(--fg)", fontSize: 15, fontWeight: 600 }}>{title}</div>
      {detail && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>{detail}</div>}
    </div>
    {trailing && <span style={{ color: selected ? "var(--accent)" : "var(--muted)", fontSize: 13, fontWeight: 600 }}>{trailing}</span>}
  </button>
);

// --- Steps ---

const StepWelcome = () => (
  <Header eyebrow="Welcome" title="Targets that adapt to your real metabolism"
    subtitle="Answer a few questions and we'll set your starting calories and macros. As you log, your targets adjust automatically — no recalculating by hand." />
);

const StepAboutYou = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Header eyebrow="Step 1" title="About you" subtitle="These set your baseline metabolic rate." />
      <Segment options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} value={a.sex} onChange={(sex) => set({ sex })} />
      <Segment options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]} value={a.units} onChange={(units) => set({ units })} />
      <Field label="Date of birth" type="date" value={a.dateOfBirth} onChange={(v) => set({ dateOfBirth: v })} />
      <Field label="Height" type="number" value={String(a.heightCm)} unit={a.units === "metric" ? "cm" : "cm (we'll convert)"} onChange={(v) => set({ heightCm: Number(v) || 0 })} />
      <Field label="Current weight" type="number" value={String(a.currentWeightKg)} unit={a.units === "metric" ? "kg" : "kg (we'll convert)"} onChange={(v) => set({ currentWeightKg: Number(v) || 0 })} />
    </div>
  );
};

const StepBodyComp = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const setBc = (patch: Partial<Assessment["bodyComp"]>) => dispatch({ type: "setBodyComp", patch });
  const choose = (method: BodyCompMethod) => dispatch({ type: "setBodyComp", patch: { method } });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Header eyebrow="Step 2 · Optional" title="Body composition" subtitle="If you have a measured body-fat %, we'll use a more accurate formula. We never ask you to guess — skip if you're not sure." />
      <SelectableRow title="I have a measured body-fat %" detail="From DEXA, smart scale, or calipers" selected={a.bodyComp.method === "direct"} onClick={() => choose("direct")} />
      <SelectableRow title="Measure with a tape" detail="We'll use the U.S. Navy method" selected={a.bodyComp.method === "tape"} onClick={() => choose("tape")} />
      <SelectableRow title="Skip for now" detail="We'll use the standard formula" selected={a.bodyComp.method === "skip"} onClick={() => choose("skip")} />
      {a.bodyComp.method === "direct" && (
        <Field label="Body fat %" type="number" unit="%" value={a.bodyComp.directBodyFatPct != null ? String(Math.round(a.bodyComp.directBodyFatPct * 100)) : ""} onChange={(v) => setBc({ directBodyFatPct: v ? Number(v) / 100 : null })} />
      )}
      {a.bodyComp.method === "tape" && (
        <>
          <Field label="Neck" type="number" unit="cm" value={a.bodyComp.neckCm != null ? String(a.bodyComp.neckCm) : ""} onChange={(v) => setBc({ neckCm: v ? Number(v) : null })} />
          <Field label="Waist" type="number" unit="cm" value={a.bodyComp.waistCm != null ? String(a.bodyComp.waistCm) : ""} onChange={(v) => setBc({ waistCm: v ? Number(v) : null })} />
          {a.sex === "female" && <Field label="Hip" type="number" unit="cm" value={a.bodyComp.hipCm != null ? String(a.bodyComp.hipCm) : ""} onChange={(v) => setBc({ hipCm: v ? Number(v) : null })} />}
        </>
      )}
    </div>
  );
};

const StepActivity = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <Header eyebrow="Step 3" title="Your lifestyle" subtitle="This sets your starting calorie estimate. We refine it from your real data each week." />
    {ACTIVITY_LEVELS.map((o) => (
      <SelectableRow key={o.key} title={o.label} detail={o.detail} selected={a.activityLevel === o.key} onClick={() => dispatch({ type: "set", patch: { activityLevel: o.key } })} />
    ))}
  </div>
);

const StepGoal = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Header eyebrow="Step 4" title="Your goal" subtitle="We'll keep your rate within a safe range." />
      <Segment options={[{ value: "cut", label: "Lose" }, { value: "maintain", label: "Maintain" }, { value: "gain", label: "Gain" }]} value={a.goalType} onChange={(goalType) => set({ goalType })} />
      {a.goalType !== "maintain" && (
        <>
          <Field label="Weekly rate" type="number" unit="kg/wk" value={String(a.rateKgPerWeek)} onChange={(v) => set({ rateKgPerWeek: Number(v) || 0 })} />
          <Field label="Goal weight (optional)" type="number" unit="kg" value={a.goalWeightKg != null ? String(a.goalWeightKg) : ""} onChange={(v) => set({ goalWeightKg: v ? Number(v) : null })} />
        </>
      )}
    </div>
  );
};

const PATTERNS: { value: DietPattern; title: string; detail: string }[] = [
  { value: "balanced", title: "Balanced", detail: "Even split, moderate protein" },
  { value: "high_protein", title: "High protein", detail: "Prioritize protein for muscle" },
  { value: "lower_carb", title: "Lower carb", detail: "More fat, fewer carbs" },
  { value: "custom", title: "Custom", detail: "Set protein and fat yourself" },
];

const StepDiet = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Header eyebrow="Step 5" title="Dietary preference" subtitle="This shapes how we split your calories into macros." />
      {PATTERNS.map((p) => (
        <SelectableRow key={p.value} title={p.title} detail={p.detail} selected={a.dietPattern === p.value} onClick={() => set({ dietPattern: p.value })} />
      ))}
      {a.dietPattern === "custom" && (
        <>
          <Field label="Protein" type="number" unit="g/kg" value={a.customProteinPerKg != null ? String(a.customProteinPerKg) : ""} onChange={(v) => set({ customProteinPerKg: v ? Number(v) : null })} />
          <Field label="Fat" type="number" unit="% of calories" value={a.customFatPct != null ? String(Math.round(a.customFatPct * 100)) : ""} onChange={(v) => set({ customFatPct: v ? Number(v) / 100 : null })} />
        </>
      )}
    </div>
  );
};

const StepReminders = () => (
  <Header eyebrow="Step 6 · Optional" title="Reminders" subtitle="Skipping for now — you can wire notifications later. Press Continue to see your starting plan." />
);

const StepPlan = ({ a, today }: { a: Assessment; today: string }) => {
  const plan = computeStartingPlan(a, today);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Header eyebrow="Your starting plan" title={`${Math.round(plan.dailyCalories).toLocaleString()} kcal / day`} subtitle="These are your starting targets. They'll adapt automatically as you log." />
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, display: "flex", gap: 16 }}>
        <Metric label="Protein" value={`${plan.macros.proteinG} g`} color="var(--viz-protein)" />
        <Metric label="Carbs" value={`${plan.macros.carbsG} g`} color="var(--viz-carbs)" />
        <Metric label="Fat" value={`${plan.macros.fatG} g`} color="var(--viz-fat)" />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        Estimated daily energy use: {Math.round(plan.tdee).toLocaleString()} kcal{plan.usedComposition ? " · using your body composition" : ""}.
      </p>
      {plan.clamped && (
        <p style={{ color: "var(--viz-warning)", fontSize: 13 }}>
          We adjusted your rate to a safer {Math.abs(plan.effectiveRateKgPerWeek).toFixed(2)} kg/week.
        </p>
      )}
    </div>
  );
};

const Metric = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{ flex: 1 }}>
    <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
    <div style={{ color, fontSize: 22, fontWeight: 800 }}>{value}</div>
  </div>
);

const btnPrimary: React.CSSProperties = { flex: 2, background: "var(--accent)", color: "#fff", border: 0, padding: "14px 20px", fontSize: 16, fontWeight: 700, borderRadius: 999, cursor: "pointer" };
const btnGhost: React.CSSProperties = { flex: 1, background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", padding: "14px 20px", fontSize: 15, fontWeight: 600, borderRadius: 999, cursor: "pointer" };
```

- [ ] **Step 3: Build + typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: no errors related to this page (errors about `@/lib/supabase` from other pages we haven't rewired yet are fine for now).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/onboarding/ apps/web/app/onboard
git commit -m "feat(web): new /onboarding multi-step assessment, drop /onboard"
```

---

## Task 9: Root router — `/` decides between onboarding and today

**Files:**
- Modify (replace): `apps/web/app/page.tsx`

- [ ] **Step 1: Replace `apps/web/app/page.tsx` entirely with**

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStore } from "@/lib/local-store";

export default function RootPage() {
  const router = useRouter();
  const hasProfile = useLocalStore((s) => s.profile !== null);

  useEffect(() => {
    router.replace(hasProfile ? "/today" : "/onboarding");
  }, [hasProfile, router]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.4 }}>Loading…</span>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): root route auto-redirects to onboarding or today"
```

---

## Task 10: `/today` — home screen

Today's calories left + macros progress + today's logged items + quick actions. This is the route the user hits 6× a day.

**Files:**
- Create: `apps/web/app/today/page.tsx`

- [ ] **Step 1: Implement `apps/web/app/today/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  type Composition, ageFromDob, cm, computeWeeklyTdee, dailyTargetFromTdee,
  isoDate, kg, latestTrendWeight, localDateInTimezone, resolveComposition,
  seedTdee, unit, updateTdeePosterior, years,
} from "@dynamic-energy/engine";
import { useLocalStore } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";

const ringPct = (n: number, d: number): number => (d > 0 ? Math.min(1, Math.max(0, n / d)) : 0);

export default function TodayPage() {
  const router = useRouter();
  const profile = useLocalStore((s) => s.profile);
  const goal = useLocalStore((s) => s.goal);

  if (!profile || !goal) {
    if (typeof window !== "undefined") router.replace("/onboarding");
    return null;
  }

  const tz = profile.timezone || "UTC";
  const today = localDateInTimezone(tz);

  // Engine inputs
  const sinceIso = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 90);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const weights = localRepos.weight.listSince(sinceIso);
  const intake = localRepos.intake.listSince(sinceIso);

  const trend = latestTrendWeight(weights) ?? (weights.length ? weights[weights.length - 1]!.weight : kg(profile.initialWeightKg));
  const composition: Composition | null = null; // Body composition logging will land in a follow-up.
  const userProfile = {
    sex: profile.sex,
    age: years(ageFromDob(profile.dateOfBirth, tz)),
    heightCm: cm(profile.heightCm),
  };

  // Walk weekly windows from earliest weight to today, applying Bayesian updates.
  const seed = seedTdee(userProfile, trend, profile.activityLevel, composition);
  let posterior = seed;
  if (weights.length > 0) {
    const start = new Date(`${weights[0]!.date}T00:00:00Z`);
    const day = start.getUTCDay();
    const delta = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    start.setUTCDate(start.getUTCDate() + delta);
    const end = new Date(`${today}T00:00:00Z`);
    let cursor = new Date(start);
    while (true) {
      const wkEnd = new Date(cursor);
      wkEnd.setUTCDate(wkEnd.getUTCDate() + 6);
      if (wkEnd > end) break;
      const wk = computeWeeklyTdee(isoDate(cursor.toISOString().slice(0, 10)), isoDate(wkEnd.toISOString().slice(0, 10)), intake, weights);
      const u = updateTdeePosterior(posterior, wk);
      posterior = u.posterior;
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  }

  const signedRate = goal.type === "maintain" ? 0 : goal.type === "cut" ? -goal.rateKgPerWeek : goal.rateKgPerWeek;
  const dailyTarget = dailyTargetFromTdee(posterior, { kgPerWeek: signedRate });

  const todayIntake = intake.find((i) => i.date === today);
  const eaten = todayIntake?.calories ?? 0;
  const left = Math.max(0, Math.round(dailyTarget - eaten));

  const proteinToday = todayIntake?.proteinG ?? 0;
  const carbsToday = todayIntake?.carbsG ?? 0;
  const fatToday = todayIntake?.fatG ?? 0;

  const todayMeals = localRepos.meal.listForDate(today);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px 96px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <header>
          <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>Today</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{new Date(`${today}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h1>
        </header>

        {/* Calories left */}
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Calories left</div>
          <div style={{ color: "var(--accent)", fontSize: 48, fontWeight: 800, lineHeight: 1, marginTop: 4 }}>{left.toLocaleString()}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
            {Math.round(eaten).toLocaleString()} eaten · {Math.round(dailyTarget).toLocaleString()} target
          </div>
        </section>

        {/* Macros */}
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, display: "flex", gap: 16 }}>
          <MacroBar label="Protein" value={proteinToday ?? 0} target={goal.proteinG} color="var(--viz-protein)" />
          <MacroBar label="Carbs"   value={carbsToday ?? 0} target={goal.carbsG} color="var(--viz-carbs)" />
          <MacroBar label="Fat"     value={fatToday ?? 0} target={goal.fatG} color="var(--viz-fat)" />
        </section>

        {/* Quick actions */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ActionLink href="/log-meal" label="Log food" />
          <ActionLink href="/log-weight" label="Log weight" />
          <ActionLink href="/log-activity" label="Log activity" />
          <ActionLink href="/profile" label="Profile" />
        </section>

        {/* Today's log */}
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Today's log</div>
          {todayMeals.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>Nothing logged yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {todayMeals.map((m) => {
                const totals = m.items.reduce((acc, i) => ({ kcal: acc.kcal + i.kcal, p: acc.p + (i.proteinG ?? 0), c: acc.c + (i.carbsG ?? 0), f: acc.f + (i.fatG ?? 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{m.items.map((i) => i.name).join(", ") || m.mealType}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{m.mealType}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(totals.kcal)} kcal</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>P {Math.round(totals.p)} · C {Math.round(totals.c)} · F {Math.round(totals.f)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const MacroBar = ({ label, value, target, color }: { label: string; value: number; target: number; color: string }) => (
  <div style={{ flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
      <span>{label}</span><span>{Math.round(value)} / {target}g</span>
    </div>
    <div style={{ height: 8, background: "var(--surface-container)", borderRadius: 999, marginTop: 6, overflow: "hidden" }}>
      <div style={{ height: 8, width: `${Math.round(ringPct(value, target) * 100)}%`, background: color, borderRadius: 999 }} />
    </div>
  </div>
);

const ActionLink = ({ href, label }: { href: string; label: string }) => (
  <Link href={href} style={{
    display: "block", padding: "16px 20px", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, color: "var(--fg)", fontSize: 15, fontWeight: 600, textDecoration: "none",
  }}>
    {label}
  </Link>
);
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: errors only in pages we haven't yet rewired (dashboard / log-meal / log-weight / convergence / import — all still importing the deleted `@/lib/supabase`). The `/today` page itself should be clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/today/
git commit -m "feat(web): /today home screen (cals left, macros, today's log)"
```

---

## Task 11: Rewire `/log-meal` to localRepos

Drop session checks, replace `repos.X.Y(...)` with `localRepos.X.Y(...)`. OFF search and the food candidate flow keep working — they're network calls that don't require auth.

**Files:**
- Modify (rewrite): `apps/web/app/log-meal/page.tsx`

- [ ] **Step 1: Read the current file**

`cat apps/web/app/log-meal/page.tsx | head -60` — confirm the structure: `MealLogger` component, search via `repos.food.searchLocal` + `searchOpenFoodFacts`, commit via `repos.meal.logMeal`. We're keeping OFF search and `computeMealItemNutrition`, dropping the local foods catalog (we don't have one).

- [ ] **Step 2: Replace `apps/web/app/log-meal/page.tsx` with**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type FoodCandidate, computeMealItemNutrition, searchOpenFoodFacts,
} from "@dynamic-energy/data";
import { localDateInTimezone } from "@dynamic-energy/engine";
import { useLocalStore, type MealType } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";

const useDebounced = <T,>(value: T, ms = 350): T => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch",     label: "Lunch" },
  { value: "dinner",    label: "Dinner" },
  { value: "snack",     label: "Snack" },
];

export default function LogMealPage() {
  const router = useRouter();
  const tz = useLocalStore((s) => s.profile?.timezone ?? "UTC");
  const cacheFood = useLocalStore((s) => s.cacheFood);
  const cachedFoods = useLocalStore((s) => s.foodsCache);

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim());
  const [remote, setRemote] = useState<FoodCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<FoodCandidate | null>(null);
  const [grams, setGrams] = useState("100");
  const [mealType, setMealType] = useState<MealType>("snack");
  const [committing, setCommitting] = useState(false);

  // Custom-food state
  const [creating, setCreating] = useState(false);
  const [c, setC] = useState({ name: "", brand: "", kcal: "", protein: "", carbs: "", fat: "" });

  // Local search over the foods we've cached, then OFF if we need more.
  const localMatches = useMemo(() => {
    if (!debounced) return [];
    const q = debounced.toLowerCase();
    return cachedFoods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [debounced, cachedFoods]);

  useEffect(() => {
    if (!debounced || localMatches.length >= 5) { setRemote([]); return; }
    let cancelled = false;
    setSearching(true); setError(null);
    void (async () => {
      try {
        const r = await searchOpenFoodFacts(debounced, 12);
        if (!cancelled) setRemote(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debounced, localMatches.length]);

  const nutrition = useMemo(() => {
    if (!selected) return null;
    const g = Number(grams);
    if (!Number.isFinite(g) || g <= 0) return null;
    return computeMealItemNutrition({
      kcalPer100g: selected.kcalPer100g,
      proteinPer100g: selected.proteinPer100g,
      carbsPer100g: selected.carbsPer100g,
      fatPer100g: selected.fatPer100g,
    }, g);
  }, [selected, grams]);

  const onCommit = () => {
    if (!selected || !nutrition) return;
    setCommitting(true); setError(null);
    try {
      cacheFood(selected);
      const today = localDateInTimezone(tz);
      localRepos.meal.add({
        date: today,
        mealType,
        items: [{
          foodId: selected.sourceRef,
          name: selected.name + (selected.brand ? ` · ${selected.brand}` : ""),
          grams: Number(grams),
          kcal: nutrition.kcal,
          proteinG: nutrition.proteinG,
          carbsG: nutrition.carbsG,
          fatG: nutrition.fatG,
        }],
      });
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCommitting(false);
    }
  };

  const onCreate = () => {
    if (!c.name.trim() || !Number.isFinite(Number(c.kcal)) || Number(c.kcal) < 0) {
      setError("Name and kcal/100g required."); return;
    }
    const custom: FoodCandidate = {
      sourceRef: `custom-${Date.now()}`,
      source: "off",
      name: c.name.trim(),
      brand: c.brand.trim() || null,
      servingSizeG: null,
      kcalPer100g: Number(c.kcal),
      proteinPer100g: c.protein ? Number(c.protein) : null,
      carbsPer100g: c.carbs ? Number(c.carbs) : null,
      fatPer100g: c.fat ? Number(c.fat) : null,
    };
    cacheFood(custom);
    setSelected(custom);
    setCreating(false);
  };

  if (selected) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px 96px" }}>
        <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <header>
            <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>Portion</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{selected.name}</h1>
            {selected.brand && <div style={{ color: "var(--muted)", fontSize: 13 }}>{selected.brand}</div>}
          </header>

          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
            <label style={{ display: "block", color: "var(--muted)", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Grams</label>
            <input type="number" value={grams} onChange={(e) => setGrams(e.target.value)} style={{ width: "100%", border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--fg)", fontSize: 40, fontWeight: 800, padding: "4px 0", outline: 0 }} />
            {nutrition && (
              <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
                <Metric label="Kcal" value={`${nutrition.kcal}`} color="var(--accent)" />
                <Metric label="P" value={`${nutrition.proteinG ?? "—"}g`} color="var(--viz-protein)" />
                <Metric label="C" value={`${nutrition.carbsG ?? "—"}g`} color="var(--viz-carbs)" />
                <Metric label="F" value={`${nutrition.fatG ?? "—"}g`} color="var(--viz-fat)" />
              </div>
            )}
          </section>

          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 8, display: "flex" }}>
            {MEAL_TYPES.map((mt) => {
              const active = mealType === mt.value;
              return (
                <button key={mt.value} onClick={() => setMealType(mt.value)} style={{ flex: 1, padding: 12, border: 0, background: active ? "var(--accent-soft)" : "transparent", color: active ? "var(--accent)" : "var(--muted)", fontSize: 13, fontWeight: 600, borderRadius: 10, cursor: "pointer" }}>
                  {mt.label}
                </button>
              );
            })}
          </section>

          {error && <div style={{ color: "var(--viz-error)", fontSize: 13 }}>{error}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSelected(null)} style={btnGhost}>Back</button>
            <button onClick={onCommit} disabled={committing || !nutrition} style={{ ...btnPrimary, opacity: committing || !nutrition ? 0.5 : 1 }}>
              {committing ? "Logging…" : "Log meal"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px 96px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <header>
          <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>Log food</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Search</h1>
        </header>

        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="oats, chicken, banana…"
          autoFocus
          style={{ width: "100%", border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--fg)", fontSize: 22, fontWeight: 700, padding: "10px 0", outline: 0 }}
        />

        {searching && <div style={{ color: "var(--muted)", fontSize: 13 }}>Searching…</div>}
        {error && <div style={{ color: "var(--viz-error)", fontSize: 13 }}>{error}</div>}

        {localMatches.length > 0 && (
          <Section label="Your recents">
            {localMatches.map((f) => <ResultRow key={f.sourceRef} f={f} onClick={() => setSelected(f)} />)}
          </Section>
        )}
        {remote.length > 0 && (
          <Section label="Open Food Facts">
            {remote.map((f) => <ResultRow key={f.sourceRef} f={f} onClick={() => setSelected(f)} />)}
          </Section>
        )}

        {!searching && debounced && localMatches.length === 0 && remote.length === 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
            <p style={{ color: "var(--muted)", marginBottom: 12 }}>No matches for &quot;{debounced}&quot;.</p>
            <button onClick={() => { setC((c) => ({ ...c, name: debounced })); setCreating(true); }} style={btnPrimary}>
              Define custom food
            </button>
          </div>
        )}

        {creating && (
          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <CField label="Name" value={c.name} onChange={(v) => setC({ ...c, name: v })} />
            <CField label="Brand (optional)" value={c.brand} onChange={(v) => setC({ ...c, brand: v })} />
            <div style={{ display: "flex", gap: 12 }}>
              <CField label="Kcal / 100g" value={c.kcal} onChange={(v) => setC({ ...c, kcal: v })} numeric />
              <CField label="Protein g" value={c.protein} onChange={(v) => setC({ ...c, protein: v })} numeric />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <CField label="Carbs g" value={c.carbs} onChange={(v) => setC({ ...c, carbs: v })} numeric />
              <CField label="Fat g" value={c.fat} onChange={(v) => setC({ ...c, fat: v })} numeric />
            </div>
            <button onClick={onCreate} style={btnPrimary}>Save & choose portion</button>
            <button onClick={() => setCreating(false)} style={btnGhost}>Cancel</button>
          </section>
        )}

        <Link href="/today" style={{ ...btnGhost, display: "inline-block", textAlign: "center" as const, textDecoration: "none" }}>
          Cancel
        </Link>
      </div>
    </main>
  );
}

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <section>
    <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{label}</div>
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
      {children}
    </div>
  </section>
);

const ResultRow = ({ f, onClick }: { f: FoodCandidate; onClick: () => void }) => (
  <button onClick={onClick} style={{ display: "block", width: "100%", padding: "14px 16px", textAlign: "left", background: "transparent", border: 0, borderBottom: "1px solid var(--border)", color: "var(--fg)", cursor: "pointer" }}>
    <div style={{ fontSize: 15, fontWeight: 600 }}>{f.name}</div>
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
      <span style={{ color: "var(--muted)", fontSize: 12 }}>{f.brand ?? "Generic"}</span>
      <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>{Math.round(f.kcalPer100g)} kcal/100g</span>
    </div>
  </button>
);

const Metric = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{ flex: 1 }}>
    <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
    <div style={{ color, fontSize: 18, fontWeight: 800 }}>{value}</div>
  </div>
);

const CField = ({ label, value, onChange, numeric }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
    <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>{label}</span>
    <input type={numeric ? "number" : "text"} value={value} onChange={(e) => onChange(e.target.value)} style={{ border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--fg)", fontSize: 18, fontWeight: 700, padding: "4px 0", outline: 0 }} />
  </label>
);

const btnPrimary: React.CSSProperties = { flex: 2, background: "var(--accent)", color: "#fff", border: 0, padding: "14px 20px", fontSize: 16, fontWeight: 700, borderRadius: 999, cursor: "pointer" };
const btnGhost: React.CSSProperties = { flex: 1, background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", padding: "14px 20px", fontSize: 15, fontWeight: 600, borderRadius: 999, cursor: "pointer" };
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: still errors in the unrewired pages, but `log-meal/page.tsx` should be clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/log-meal/page.tsx
git commit -m "feat(web): rewire /log-meal to localRepos (drop auth)"
```

---

## Task 12: Rewire `/log-weight` to localRepos

**Files:**
- Modify (rewrite): `apps/web/app/log-weight/page.tsx`

- [ ] **Step 1: Replace `apps/web/app/log-weight/page.tsx` with**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { localDateInTimezone } from "@dynamic-energy/engine";
import { useLocalStore } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";

export default function LogWeightPage() {
  const router = useRouter();
  const tz = useLocalStore((s) => s.profile?.timezone ?? "UTC");
  const today = localDateInTimezone(tz);

  const [date, setDate] = useState(today);
  const [weightKg, setWeightKg] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(weightKg) > 0;

  const onSubmit = () => {
    if (!valid) return;
    setBusy(true); setError(null);
    try {
      localRepos.weight.log({ date, weightKg: Number(weightKg), note: note.trim() || undefined });
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px 96px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <header>
          <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>Log weight</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Today's reading</h1>
        </header>

        <Field label="Date" type="date" value={date} onChange={setDate} max={today} />
        <Field label="Weight (kg)" type="number" value={weightKg} onChange={setWeightKg} placeholder="e.g. 82.5" big />
        <Field label="Note (optional)" type="text" value={note} onChange={setNote} placeholder="post-workout, high sodium…" />

        {error && <div style={{ color: "var(--viz-error)", fontSize: 13 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/today" style={btnGhost as React.CSSProperties & { textDecoration: string }}>Cancel</Link>
          <button onClick={onSubmit} disabled={busy || !valid} style={{ ...btnPrimary, opacity: busy || !valid ? 0.5 : 1 }}>
            {busy ? "Saving…" : "Log weight →"}
          </button>
        </div>
      </div>
    </main>
  );
}

const Field = ({ label, type, value, onChange, unit, placeholder, max, big }: {
  label: string; type: "text" | "number" | "date"; value: string; onChange: (v: string) => void;
  unit?: string; placeholder?: string; max?: string; big?: boolean;
}) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>{label}</span>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} max={max}
        style={{ flex: 1, border: 0, outline: 0, background: "transparent", color: "var(--fg)", fontSize: big ? 32 : 22, fontWeight: 800, padding: 0 }}
      />
      {unit && <span style={{ color: "var(--muted)", fontSize: 14, fontWeight: 600 }}>{unit}</span>}
    </div>
  </label>
);

const btnPrimary: React.CSSProperties = { flex: 2, background: "var(--accent)", color: "#fff", border: 0, padding: "14px 20px", fontSize: 16, fontWeight: 700, borderRadius: 999, cursor: "pointer" };
const btnGhost = { flex: 1, background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", padding: "14px 20px", fontSize: 15, fontWeight: 600, borderRadius: 999, cursor: "pointer", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd apps/web && npm run typecheck` (clean for this file)
```bash
git add apps/web/app/log-weight/page.tsx
git commit -m "feat(web): rewire /log-weight to localRepos"
```

---

## Task 13: New `/log-activity` page

**Files:**
- Create: `apps/web/app/log-activity/page.tsx`

- [ ] **Step 1: Implement `apps/web/app/log-activity/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ACTIVITY_CATALOG, type ActivityKey, kg, latestTrendWeight, localDateInTimezone, met, minutes, activeCalories } from "@dynamic-energy/engine";
import { useLocalStore } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";

export default function LogActivityPage() {
  const router = useRouter();
  const profile = useLocalStore((s) => s.profile);
  const tz = profile?.timezone ?? "UTC";
  const today = localDateInTimezone(tz);

  const weights = localRepos.weight.listSince("1970-01-01");
  const trend = latestTrendWeight(weights) ?? (profile ? kg(profile.initialWeightKg) : kg(70));

  const entries = useMemo(() => Object.entries(ACTIVITY_CATALOG) as [ActivityKey, { label: string; met: number; group: string }][], []);
  const [activityKey, setActivityKey] = useState<ActivityKey>(entries[0]![0]);
  const [duration, setDuration] = useState("30");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = ACTIVITY_CATALOG[activityKey];
  const mins = Number(duration) || 0;
  const kcal = mins > 0 ? Math.round(activeCalories(trend, met(chosen.met), minutes(mins))) : 0;

  const onSubmit = () => {
    if (!mins || mins <= 0) return;
    setBusy(true); setError(null);
    try {
      localRepos.activity.log({
        date,
        activityType: chosen.label,
        metValue: chosen.met,
        durationMin: mins,
        caloriesActive: kcal,
      });
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px 96px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <header>
          <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>Log activity</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>What did you do?</h1>
        </header>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>Activity</span>
          <select value={activityKey} onChange={(e) => setActivityKey(e.target.value as ActivityKey)}
            style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)", borderRadius: 12, padding: "12px 14px", fontSize: 15 }}>
            {entries.map(([key, v]) => (
              <option key={key} value={key}>{v.label} · {v.met} MET</option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>Duration (min)</span>
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} style={{ border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--fg)", fontSize: 32, fontWeight: 800, padding: "4px 0", outline: 0 }} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>Date</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)", borderRadius: 12, padding: "12px 14px", fontSize: 15 }} />
        </label>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Estimated active calories</div>
          <div style={{ color: "var(--accent)", fontSize: 32, fontWeight: 800 }}>{kcal} kcal</div>
        </div>

        {error && <div style={{ color: "var(--viz-error)", fontSize: 13 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/today" style={btnGhost as React.CSSProperties & { textDecoration: string }}>Cancel</Link>
          <button onClick={onSubmit} disabled={busy || mins <= 0} style={{ ...btnPrimary, opacity: busy || mins <= 0 ? 0.5 : 1 }}>
            {busy ? "Saving…" : "Log activity →"}
          </button>
        </div>
      </div>
    </main>
  );
}

const btnPrimary: React.CSSProperties = { flex: 2, background: "var(--accent)", color: "#fff", border: 0, padding: "14px 20px", fontSize: 16, fontWeight: 700, borderRadius: 999, cursor: "pointer" };
const btnGhost = { flex: 1, background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", padding: "14px 20px", fontSize: 15, fontWeight: 600, borderRadius: 999, cursor: "pointer", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd apps/web && npm run typecheck` (clean for this file)
```bash
git add apps/web/app/log-activity/
git commit -m "feat(web): /log-activity page (MET catalog + engine activeCalories)"
```

---

## Task 14: Rewire `/dashboard` (Trends) to localRepos

The existing dashboard already computes everything via the engine. We just swap data fetching from Supabase repos to `localRepos`, drop the session/onboarding-empty guards (the root redirector handles that), and keep the charts.

**Files:**
- Modify (rewrite): `apps/web/app/dashboard/page.tsx`

- [ ] **Step 1: Read the current `dashboard/page.tsx` structure**

Run: `cat apps/web/app/dashboard/page.tsx | head -80` to confirm the imports.

- [ ] **Step 2: Apply targeted edits**

Replace the imports block at the top with:
```tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  type Composition, type IntakeEntry, type KcalDay,
  type WeeklyTdeeResult, type WeightEntry,
  computeWeeklyTdee, dailyTargetFromTdee, ewmaTrend, isoDate, latestTrendWeight,
  resolveComposition, seedTdee, unit, updateTdeePosterior, cm, years, ageFromDob,
} from "@dynamic-energy/engine";
import { LineChart } from "@/components/LineChart";
import { Runway } from "@/components/Runway";
import { pct, round0, round1, signed } from "@/lib/format";
import { useLocalStore } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";
```

Remove the `useState`/`useEffect`/`Session`/`supabase` imports entirely.

Replace the existing `DashboardPage` function body. Use this implementation (it's a faithful rewrite of the existing flow against localRepos, dropping all auth/loading/empty guards because the root redirector handles those):

```tsx
export default function DashboardPage() {
  const profile = useLocalStore((s) => s.profile);
  const goal = useLocalStore((s) => s.goal);

  if (!profile || !goal) {
    return (
      <main className="container section">
        <h1 className="h2">No data yet</h1>
        <p style={{ color: "var(--muted)", marginTop: 12 }}>
          <Link href="/onboarding" style={{ color: "var(--accent)" }}>Run onboarding</Link> to set up your profile.
        </p>
      </main>
    );
  }

  const tz = profile.timezone || "UTC";

  const since = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 90);
    return d.toISOString().slice(0, 10);
  }, []);

  const weights = localRepos.weight.listSince(since);
  const intake = localRepos.intake.listSince(since);

  if (weights.length === 0) {
    return (
      <main className="container section">
        <h1 className="h2">Log a weight to see trends</h1>
        <Link href="/log-weight" style={{ color: "var(--accent)" }}>Go to /log-weight</Link>
      </main>
    );
  }

  const userProfile = {
    sex: profile.sex,
    age: years(ageFromDob(profile.dateOfBirth, tz)),
    heightCm: cm(profile.heightCm),
  };

  const trendWeight = latestTrendWeight(weights) ?? weights[weights.length - 1]!.weight;
  const composition: Composition | null = null;

  const seedPrior = seedTdee(userProfile, weights[weights.length - 1]!.weight, profile.activityLevel, composition);
  const startDate = weights[0]!.date;
  const endDate = weights[weights.length - 1]!.date;

  // Monday windows from start → end
  const windows = (() => {
    const s = new Date(`${startDate}T00:00:00Z`);
    const e = new Date(`${endDate}T00:00:00Z`);
    const day = s.getUTCDay();
    const delta = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    s.setUTCDate(s.getUTCDate() + delta);
    const out: { start: string; end: string }[] = [];
    while (true) {
      const wkEnd = new Date(s);
      wkEnd.setUTCDate(wkEnd.getUTCDate() + 6);
      if (wkEnd > e) break;
      out.push({ start: s.toISOString().slice(0, 10), end: wkEnd.toISOString().slice(0, 10) });
      s.setUTCDate(s.getUTCDate() + 7);
    }
    return out;
  })();

  const history: Array<{ week: { start: string; end: string }; result: WeeklyTdeeResult; posterior: KcalDay; alpha: number; prior: KcalDay; }> = [];
  let prior = seedPrior;
  for (const w of windows) {
    const result = computeWeeklyTdee(isoDate(w.start), isoDate(w.end), intake, weights);
    const u = updateTdeePosterior(prior, result);
    history.push({ week: w, result, posterior: u.posterior, alpha: u.alpha, prior });
    prior = u.posterior;
  }

  const currentTdee = history[history.length - 1]?.posterior ?? seedPrior;
  const signedRate = goal.type === "maintain" ? 0 : goal.type === "cut" ? -goal.rateKgPerWeek : goal.rateKgPerWeek;
  const target = dailyTargetFromTdee(currentTdee, { kgPerWeek: signedRate });

  const trend = ewmaTrend(weights);
  const todayIntake = intake[intake.length - 1]?.calories ?? 0;
  const fillFraction = target ? todayIntake / target : 0;

  const tdeeSeries = history.map((h, i) => ({ x: i / Math.max(history.length - 1, 1), y: h.posterior as number }));
  const weightScatter = weights.map((w, i) => ({ x: i / Math.max(weights.length - 1, 1), y: w.weight as number }));
  const weightTrend = trend.map((t, i) => ({ x: i / Math.max(trend.length - 1, 1), y: t.trend as number }));

  return (
    <main className="container section" style={{ maxWidth: 960, paddingBottom: 96 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
        <div>
          <span className="eyebrow">Trends</span>
          <h1 className="h2" style={{ marginTop: 4 }}>Your dynamics</h1>
        </div>
        <Link href="/today" style={{ color: "var(--accent)" }}>← Today</Link>
      </header>

      <section className="glass-card glass-card-lg" style={{ marginBottom: 16 }}>
        <span className="meta">Today · runway</span>
        <Runway fillFraction={fillFraction} targetFraction={1} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <div><span className="meta">Logged</span><div className="bignum">{round0(todayIntake)}</div></div>
          <div style={{ textAlign: "right" }}>
            <span className="meta">Target</span>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{round0(target)}</div>
          </div>
        </div>
      </section>

      <section className="glass-card glass-card-lg" style={{ marginBottom: 16 }}>
        <span className="meta">Inferred TDEE</span>
        <h2 className="h1 text-accent" style={{ fontSize: 44, fontWeight: 700, marginTop: 4 }}>
          {round0(currentTdee)} <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400 }}>kcal / day</span>
        </h2>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {history.length > 0 && (
          <section className="glass-card glass-card-lg">
            <span className="meta">TDEE convergence ({history.length} weeks)</span>
            <LineChart series={tdeeSeries}
              yMin={Math.min(...tdeeSeries.map((p) => p.y)) - 50}
              yMax={Math.max(...tdeeSeries.map((p) => p.y)) + 50}
              xStartLabel={startDate} xEndLabel={endDate}
            />
          </section>
        )}
        <section className="glass-card glass-card-lg">
          <span className="meta">Weight · raw + EWMA trend</span>
          <LineChart series={weightTrend} scatter={weightScatter}
            yMin={Math.min(...weightScatter.map((p) => p.y)) - 0.5}
            yMax={Math.max(...weightScatter.map((p) => p.y)) + 0.5}
            xStartLabel={startDate} xEndLabel={endDate}
          />
        </section>
      </div>

      {history.length > 0 && (
        <section className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 0.8fr", gap: "1px", background: "var(--border)" }}>
            {["Week", "Avg intake", "Δ trend", "Inferred TDEE", "Posterior", "α"].map((h) => (
              <div key={h} className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">{h}</span></div>
            ))}
            {history.slice().reverse().map((h, i) => {
              const dropped = h.alpha === 0;
              return (
                <Row key={i} h={h} dropped={dropped} />
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

const Row = ({ h, dropped }: { h: { week: { start: string; end: string }; result: WeeklyTdeeResult; posterior: KcalDay; alpha: number; prior: KcalDay }; dropped: boolean }) => (
  <>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 13 }}>{h.week.start}</span>
      <span className="meta">{pct(h.result.completeness)} complete</span>
    </div>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 16 }}>{round0(h.result.avgIntake)}</span>
    </div>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 16, color: h.result.deltaWeightKg < 0 ? "var(--accent)" : "var(--fg)" }}>{signed(h.result.deltaWeightKg, 2)} kg</span>
    </div>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 16 }}>{round0(h.result.tdeeWeek)}</span>
    </div>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 16, fontWeight: 700, color: dropped ? "var(--muted)" : "var(--accent)" }}>{round0(h.posterior)}</span>
      <span className="meta">{signed(h.posterior - h.prior)}</span>
    </div>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 16, color: dropped ? "var(--muted)" : "var(--fg)" }}>{dropped ? "—" : h.alpha.toFixed(2)}</span>
    </div>
  </>
);
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd apps/web && npm run typecheck` — dashboard is clean (remaining errors are in `/convergence` and `/import`).
```bash
git add apps/web/app/dashboard/page.tsx
git commit -m "feat(web): rewire /dashboard to localRepos (drop auth)"
```

---

## Task 15: Rewire `/convergence` to localRepos (becomes Coach)

This page already lets the user "accept" weekly engine state. Rewire to read/write the local store.

**Files:**
- Modify (rewrite): `apps/web/app/convergence/page.tsx`

- [ ] **Step 1: Replace `apps/web/app/convergence/page.tsx` with**

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type Composition, type KcalDay, type WeeklyTdeeResult,
  ageFromDob, cm, computeWeeklyTdee, isoDate, latestTrendWeight,
  resolveComposition, seedTdee, unit, updateTdeePosterior, years,
} from "@dynamic-energy/engine";
import { useLocalStore } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";
import { pct, round0, signed } from "@/lib/format";

type Week = { week: { start: string; end: string }; result: WeeklyTdeeResult; posterior: KcalDay; alpha: number; prior: KcalDay };

export default function ConvergencePage() {
  const router = useRouter();
  const profile = useLocalStore((s) => s.profile);
  const upsertEngineWeek = useLocalStore((s) => s.upsertEngineWeek);

  const [accepting, setAccepting] = useState<string | null>(null);

  if (!profile) { if (typeof window !== "undefined") router.replace("/onboarding"); return null; }
  const tz = profile.timezone || "UTC";

  const sinceIso = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 90);
    return d.toISOString().slice(0, 10);
  }, []);

  const weights = localRepos.weight.listSince(sinceIso);
  const intake = localRepos.intake.listSince(sinceIso);

  if (weights.length === 0) {
    return (
      <main className="container section">
        <h1 className="h2">Not enough data</h1>
        <p style={{ color: "var(--muted)", marginTop: 12 }}>
          Log weight for at least one week, then come back. <Link href="/log-weight" style={{ color: "var(--accent)" }}>Log weight</Link>
        </p>
      </main>
    );
  }

  const userProfile = {
    sex: profile.sex,
    age: years(ageFromDob(profile.dateOfBirth, tz)),
    heightCm: cm(profile.heightCm),
  };
  const trend = latestTrendWeight(weights) ?? weights[weights.length - 1]!.weight;
  const composition: Composition | null = null;
  const seedPrior = seedTdee(userProfile, weights[weights.length - 1]!.weight, profile.activityLevel, composition);

  // Monday windows
  const startDate = weights[0]!.date;
  const endDate = weights[weights.length - 1]!.date;
  const windows = (() => {
    const s = new Date(`${startDate}T00:00:00Z`);
    const e = new Date(`${endDate}T00:00:00Z`);
    const day = s.getUTCDay();
    const delta = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    s.setUTCDate(s.getUTCDate() + delta);
    const out: { start: string; end: string }[] = [];
    while (true) {
      const wkEnd = new Date(s);
      wkEnd.setUTCDate(wkEnd.getUTCDate() + 6);
      if (wkEnd > e) break;
      out.push({ start: s.toISOString().slice(0, 10), end: wkEnd.toISOString().slice(0, 10) });
      s.setUTCDate(s.getUTCDate() + 7);
    }
    return out;
  })();

  const history: Week[] = [];
  let prior = seedPrior;
  for (const w of windows) {
    const result = computeWeeklyTdee(isoDate(w.start), isoDate(w.end), intake, weights);
    const u = updateTdeePosterior(prior, result);
    history.push({ week: w, result, posterior: u.posterior, alpha: u.alpha, prior });
    prior = u.posterior;
  }

  const acceptOne = (entry: Week) => {
    setAccepting(entry.week.start);
    upsertEngineWeek({
      weekStart: entry.week.start,
      tdeePrior: entry.prior as number,
      tdeeWeek: entry.result.tdeeWeek as number,
      tdeePosterior: entry.posterior as number,
      alpha: entry.alpha,
      avgIntake: entry.result.avgIntake as number,
      deltaWeightKg: entry.result.deltaWeightKg,
      accepted: true,
    });
    setAccepting(null);
  };

  const acceptAll = () => {
    for (const entry of history) acceptOne(entry);
    router.push("/today");
  };

  const current = history[history.length - 1]?.posterior ?? seedPrior;

  return (
    <main className="container section" style={{ maxWidth: 720, paddingBottom: 96 }}>
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">Coach</span>
        <h1 className="h2" style={{ marginTop: 4 }}>Weekly check-in</h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>Accept weeks to lock in your adapted targets.</p>
      </header>

      <section className="glass-card glass-card-lg" style={{ marginBottom: 16 }}>
        <span className="meta">Current posterior</span>
        <h2 className="h1 text-accent" style={{ fontSize: 44, fontWeight: 800, marginTop: 4 }}>
          {round0(current)} <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400 }}>kcal / day</span>
        </h2>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={acceptAll} disabled={accepting !== null || history.length === 0} style={{ flex: 2, background: "var(--accent)", color: "#fff", border: 0, padding: "14px 20px", fontSize: 15, fontWeight: 700, borderRadius: 999, cursor: "pointer", opacity: accepting !== null ? 0.5 : 1 }}>
            {accepting !== null ? "Saving…" : `Accept all ${history.length} weeks →`}
          </button>
          <Link href="/today" style={{ flex: 1, padding: "14px 20px", borderRadius: 999, border: "1px solid var(--border)", color: "var(--muted)", textDecoration: "none", textAlign: "center", fontSize: 15, fontWeight: 600 }}>Back</Link>
        </div>
      </section>

      {history.length > 0 && (
        <section className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 0.7fr 1fr", gap: "1px", background: "var(--border)" }}>
            {["Week", "Avg intake", "Δ weight", "Inferred", "Posterior", "α", "Action"].map((h) => (
              <div key={h} className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">{h}</span></div>
            ))}
            {history.slice().reverse().map((entry) => {
              const dropped = entry.alpha === 0;
              return (
                <Row key={entry.week.start} entry={entry} dropped={dropped}
                  onAccept={() => acceptOne(entry)}
                  busy={accepting === entry.week.start} />
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

const Row = ({ entry, dropped, onAccept, busy }: { entry: Week; dropped: boolean; onAccept: () => void; busy: boolean }) => (
  <>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 12 }}>{entry.week.start}</span>
      <span className="meta">{pct(entry.result.completeness)}</span>
    </div>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 15 }}>{round0(entry.result.avgIntake)}</span>
    </div>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 15, color: entry.result.deltaWeightKg < 0 ? "var(--accent)" : "var(--fg)" }}>{signed(entry.result.deltaWeightKg, 2)} kg</span>
    </div>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 15 }}>{round0(entry.result.tdeeWeek)}</span>
    </div>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 15, fontWeight: 700, color: dropped ? "var(--muted)" : "var(--accent)" }}>{round0(entry.posterior)}</span>
      <span className="meta">{signed(entry.posterior - entry.prior)}</span>
    </div>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <span className="num" style={{ fontSize: 15, color: dropped ? "var(--muted)" : "var(--fg)" }}>{dropped ? "—" : entry.alpha.toFixed(2)}</span>
    </div>
    <div className="tg-cell" style={{ background: "var(--surface)" }}>
      <button onClick={onAccept} disabled={busy || dropped} style={{
        background: dropped ? "transparent" : "var(--accent)", color: dropped ? "var(--muted)" : "#fff",
        border: dropped ? "1px solid var(--border)" : 0, padding: "6px 12px", fontSize: 11, fontWeight: 600,
        borderRadius: 6, cursor: dropped ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1,
      }}>{busy ? "…" : dropped ? "Skip" : "Accept"}</button>
    </div>
  </>
);
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/web && npm run typecheck
git add apps/web/app/convergence/page.tsx
git commit -m "feat(web): rewire /convergence to localRepos (Coach)"
```

---

## Task 16: Rewire `/import` to localRepos (or strip)

The existing MFP CSV importer takes a file, parses it (pure), and writes each row to Supabase. We rewire the write path to localRepos.

**Files:**
- Modify (rewrite): `apps/web/app/import/page.tsx`

- [ ] **Step 1: Replace `apps/web/app/import/page.tsx` with**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ImportPreview, parseMfpCsv } from "@dynamic-energy/data";
import { localRepos } from "@/lib/local-repos";

export default function ImportPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const p = parseMfpCsv(text);
      setPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onCommit = () => {
    if (!preview) return;
    setCommitting(true);
    try {
      for (const m of preview.meals) {
        localRepos.meal.add({
          date: m.date,
          mealType: m.mealType,
          items: [{ name: m.name, grams: m.grams, kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG }],
        });
      }
      for (const w of preview.weights) {
        localRepos.weight.log({ date: w.date, weightKg: w.weightKg });
      }
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCommitting(false);
    }
  };

  return (
    <main className="container section" style={{ maxWidth: 720, paddingBottom: 96 }}>
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">Import</span>
        <h1 className="h2" style={{ marginTop: 4 }}>MyFitnessPal CSV</h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>Drop your MFP food or measurements export. We'll preview and import to your local store.</p>
      </header>

      <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} style={{ marginBottom: 16 }} />

      {error && <div style={{ color: "var(--viz-error)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {preview && (
        <section className="glass-card glass-card-lg" style={{ marginBottom: 16 }}>
          <p>Meals: <strong>{preview.meals.length}</strong></p>
          <p>Weights: <strong>{preview.weights.length}</strong></p>
          <p>Body measurements: <strong>{preview.bodyMeasurements.length}</strong> (not imported in v1)</p>
          <p style={{ color: "var(--muted)" }}>Skipped rows: {preview.skipped.length}</p>
          <button onClick={onCommit} disabled={committing} style={{ marginTop: 16, background: "var(--accent)", color: "#fff", border: 0, padding: "12px 24px", borderRadius: 999, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {committing ? "Importing…" : "Import to my account"}
          </button>
        </section>
      )}

      <Link href="/today" style={{ color: "var(--accent)" }}>← Today</Link>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/web && npm run typecheck
git add apps/web/app/import/page.tsx
git commit -m "feat(web): rewire /import to localRepos"
```

---

## Task 17: `/profile` page with export / import / reset

The user's command-center for editing the goal, exporting a JSON backup, importing a JSON backup, and nuking the local store.

**Files:**
- Create: `apps/web/app/profile/page.tsx`

- [ ] **Step 1: Create `apps/web/app/profile/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalStore, initialLocalState, type LocalState } from "@/lib/local-store";

export default function ProfilePage() {
  const router = useRouter();
  const profile = useLocalStore((s) => s.profile);
  const goal = useLocalStore((s) => s.goal);
  const loadState = useLocalStore((s) => s.loadState);
  const reset = useLocalStore((s) => s.reset);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onExport = () => {
    const snapshot = useLocalStore.getState();
    const data: LocalState = {
      schemaVersion: 1,
      profile: snapshot.profile,
      goal: snapshot.goal,
      weights: snapshot.weights,
      meals: snapshot.meals,
      activities: snapshot.activities,
      engineWeeks: snapshot.engineWeeks,
      foodsCache: snapshot.foodsCache,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `det-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as LocalState;
      if (data.schemaVersion !== 1) throw new Error(`Unsupported schema v${data.schemaVersion}`);
      loadState({ ...initialLocalState, ...data });
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onReset = () => {
    if (!confirm("This wipes everything (profile, weights, meals, activity). Continue?")) return;
    reset();
    router.replace("/onboarding");
  };

  return (
    <main className="container section" style={{ maxWidth: 540, paddingBottom: 96 }}>
      <header style={{ marginBottom: 24 }}>
        <span className="eyebrow">Profile</span>
        <h1 className="h2" style={{ marginTop: 4 }}>Settings</h1>
      </header>

      {profile && goal && (
        <section className="glass-card glass-card-lg" style={{ marginBottom: 16 }}>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Current</div>
          <div style={{ marginTop: 8, fontSize: 15 }}>
            <div>{profile.sex} · born {profile.dateOfBirth}</div>
            <div>{profile.heightCm} cm · started at {profile.initialWeightKg} kg</div>
            <div>{profile.activityLevel} · goal: {goal.type} {goal.rateKgPerWeek} kg/wk</div>
            <div>targets: P {goal.proteinG}g · C {goal.carbsG}g · F {goal.fatG}g</div>
          </div>
          <Link href="/onboarding" style={{ display: "inline-block", marginTop: 12, color: "var(--accent)" }}>Re-run onboarding</Link>
        </section>
      )}

      <section className="glass-card glass-card-lg" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Backup</h3>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Your data lives in your browser. Export regularly so you don't lose it.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={onExport} style={btn}>Export JSON</button>
          <button onClick={() => fileRef.current?.click()} style={btn}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); }} />
        </div>
        {error && <div style={{ color: "var(--viz-error)", fontSize: 13, marginTop: 8 }}>{error}</div>}
      </section>

      <section className="glass-card glass-card-lg">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Danger zone</h3>
        <button onClick={onReset} style={{ ...btn, background: "var(--viz-error)", color: "#fff", borderColor: "var(--viz-error)" }}>Wipe everything</button>
      </section>

      <Link href="/today" style={{ display: "inline-block", marginTop: 24, color: "var(--accent)" }}>← Today</Link>
    </main>
  );
}

const btn: React.CSSProperties = {
  background: "var(--surface)", color: "var(--fg)", border: "1px solid var(--border)",
  padding: "10px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
};
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/web && npm run typecheck
git add apps/web/app/profile/
git commit -m "feat(web): /profile with export/import/reset"
```

---

## Task 18: Bottom tab bar

A simple shared bottom-bar component shown on every signed-in page (`/today`, `/log-meal`, `/log-weight`, `/log-activity`, `/dashboard`, `/convergence`, `/profile`). Don't show on `/onboarding` and `/`.

**Files:**
- Create: `apps/web/components/TabBar.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create `apps/web/components/TabBar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string }[] = [
  { href: "/today", label: "Today" },
  { href: "/log-meal", label: "Log food" },
  { href: "/dashboard", label: "Trends" },
  { href: "/convergence", label: "Coach" },
  { href: "/profile", label: "Profile" },
];

const HIDE_ON = ["/", "/onboarding"];

export const TabBar = () => {
  const pathname = usePathname() || "/";
  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "var(--surface)", borderTop: "1px solid var(--border)",
      display: "grid", gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} style={{
            padding: "10px 4px 12px", textAlign: "center",
            color: active ? "var(--accent)" : "var(--muted)",
            fontSize: 11, fontWeight: 600, textDecoration: "none",
          }}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
};
```

- [ ] **Step 2: Mount it from `apps/web/app/layout.tsx`**

Read the file first. Add an import:
```tsx
import { TabBar } from "@/components/TabBar";
```
And render `<TabBar />` immediately after `{children}` inside the body. Do not touch anything else in the layout.

- [ ] **Step 3: Typecheck + commit**

```bash
cd apps/web && npm run typecheck
git add apps/web/components/TabBar.tsx apps/web/app/layout.tsx
git commit -m "feat(web): bottom tab bar (hides on root + onboarding)"
```

---

## Task 19: PWA manifest polish

**Files:**
- Modify: `apps/web/public/manifest.json`

- [ ] **Step 1: Replace `apps/web/public/manifest.json` with**

```json
{
  "name": "Dynamic Energy Tracker",
  "short_name": "DET",
  "description": "Personal calorie + macro tracker with adaptive targets.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#FBFAF8",
  "theme_color": "#3B5BDB",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/apple-touch-icon.svg",
      "sizes": "180x180",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ],
  "shortcuts": [
    { "name": "Log food", "url": "/log-meal", "short_name": "Food" },
    { "name": "Log weight", "url": "/log-weight", "short_name": "Weight" },
    { "name": "Today", "url": "/today", "short_name": "Today" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/public/manifest.json
git commit -m "feat(web): polish PWA manifest (name, shortcuts, theme color)"
```

---

## Task 20: Full verification + deploy

**Files:** none (verification + push)

- [ ] **Step 1: Run the full web test suite**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker/apps/web" && npm test
```
Expected: all suites pass (local-store, local-repos, onboarding/{assessment, plan, validation, persistence}).

- [ ] **Step 2: Typecheck**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker/apps/web" && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Local dev smoke**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker/apps/web" && npm run dev
```
In a browser at `http://localhost:3000`:
- Open in a fresh incognito window. Lands on `/onboarding` (because no local profile).
- Walk through the 8 steps. The Plan step shows non-zero calories and macros.
- "Start tracking →" lands you on `/today` with calories left = target.
- `/log-meal` — search "oats", pick one, choose grams + meal type, log. Back on `/today`, calories drop and macros bar shows movement.
- `/log-weight` — log today's weight. `/dashboard` shows the data point.
- `/log-activity` — log 30 min walking. No error.
- `/convergence` — needs more data; OK if empty.
- `/profile` — Export JSON downloads a file. Import the same file: still works.
- Tab bar shows at bottom on these pages, not on `/onboarding`.

- [ ] **Step 4: Build for production**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker/apps/web" && npm run build
```
Expected: successful build, no errors.

- [ ] **Step 5: Push the branch**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker" && git push -u origin feat/personal-pwa
```
Vercel auto-deploys preview for the branch. Wait ~1 min, open the preview URL on your phone (Safari), Share → Add to Home Screen.

- [ ] **Step 6: Merge to main**

Once you've used the preview deploy for 5 minutes and it works:
```bash
gh pr create --base main --head feat/personal-pwa \
  --title "Personal-use PWA (localStorage, no auth)" \
  --body "Strips Supabase + auth from the web app. Local zustand store + JSON export/import. Full scientific onboarding ported from the closed mobile branch. Adds /today, /log-activity, /profile. Rewires /log-meal, /log-weight, /dashboard, /convergence, /import to localRepos. Apply Clarity palette. PWA-installable."
gh pr merge --merge
```
Vercel deploys main → production. Your home-screen app picks it up.

---

## Self-Review

**Spec coverage:**
- Strip Supabase + auth → Tasks 3, 11–16. ✓
- localStorage data layer → Tasks 4–5. ✓
- Onboarding (scientific assessment) → Tasks 6–8. ✓
- Today screen with calories + macros → Task 10. ✓
- Log meal (OFF search, custom, portions) → Task 11. ✓
- Log weight → Task 12. ✓
- Log activity → Task 13. ✓
- Trends → Task 14. ✓
- Weekly check-in (Coach) → Task 15. ✓
- Profile + export/import → Task 17. ✓
- Tab bar nav → Task 18. ✓
- PWA on phone → Tasks 19–20. ✓
- Clarity design language → Task 2. ✓

**Placeholder scan:** no TBD/TODO; every code block is complete.

**Type consistency:** `LocalState`, `LocalProfile`, `LocalGoal`, `LocalWeightEntry`, `LocalMeal`, `LocalMealItem`, `LocalActivity`, `LocalEngineWeek` are defined once in `local-store.ts` and referenced consistently elsewhere. `localRepos.weight.log` / `localRepos.meal.add` / `localRepos.activity.log` signatures match how they're called from the page tasks.

**Known follow-ups (next plan):** body composition logging UI, recipes, barcode scanning (camera API), dark mode for web, push notifications for reminders.
