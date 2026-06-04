# Clarity Foundation + Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the "Clarity" design foundation (light+dark tokens + theme hook) on the mobile app and replace the cramped single-screen onboarding with a multi-step scientific assessment that computes accurate starting targets and persists a full profile.

**Architecture:** Pure, framework-free logic (assessment model, target computation, validation, persistence payloads) lives in `apps/mobile/src/onboarding/` and is unit-tested with vitest. React Native screens are thin presentation wired to that tested core. The existing `@dynamic-energy/engine` does all the science; we never reimplement formulas. A new `completeOnboarding` store action persists via the existing `@dynamic-energy/data` repositories.

**Tech Stack:** Expo / React Native 0.81, expo-router 6, zustand 5, `@dynamic-energy/engine`, `@dynamic-energy/data` (Supabase repos), AsyncStorage, vitest 4 (new for mobile).

**Scope note:** This is Plan 1 of 2 for the approved milestone. Plan 2 covers the Today/Home redesign, Log redesign, and tab-bar shell. Reminder *scheduling* (expo-notifications) is deferred to Plan 2 where the app shell exists; this plan captures and persists reminder *preferences* only.

**Reference spec:** `docs/superpowers/specs/2026-06-03-clarity-redesign-design.md`

---

## File Structure

**Create:**
- `apps/mobile/vitest.config.ts` — vitest config for pure mobile logic
- `apps/mobile/src/design/theme.ts` — light+dark Clarity palettes + `resolveTheme()`
- `apps/mobile/src/design/ThemeProvider.tsx` — context + `useTheme()` hook
- `apps/mobile/src/onboarding/assessment.ts` — assessment state, reducer, initial state
- `apps/mobile/src/onboarding/assessment.test.ts`
- `apps/mobile/src/onboarding/plan.ts` — `computeStartingPlan()` via engine
- `apps/mobile/src/onboarding/plan.test.ts`
- `apps/mobile/src/onboarding/validation.ts` — per-step validity
- `apps/mobile/src/onboarding/validation.test.ts`
- `apps/mobile/src/onboarding/persistence.ts` — `buildOnboardingWrite()`
- `apps/mobile/src/onboarding/persistence.test.ts`
- `apps/mobile/src/onboarding/reminders.ts` — AsyncStorage read/write for reminder prefs
- `apps/mobile/src/onboarding/steps/StepWelcome.tsx`
- `apps/mobile/src/onboarding/steps/StepAboutYou.tsx`
- `apps/mobile/src/onboarding/steps/StepBodyComposition.tsx`
- `apps/mobile/src/onboarding/steps/StepActivity.tsx`
- `apps/mobile/src/onboarding/steps/StepGoal.tsx`
- `apps/mobile/src/onboarding/steps/StepDiet.tsx`
- `apps/mobile/src/onboarding/steps/StepReminders.tsx`
- `apps/mobile/src/onboarding/steps/StepPlan.tsx`
- `apps/mobile/src/onboarding/ui.tsx` — shared step UI primitives (Field, Segment, SelectableRow, ProgressBar)

**Modify:**
- `apps/mobile/src/design/tokens.ts` — replace Navigator-Light palette values with Clarity light values (keeps export shape; existing screens restyle automatically)
- `apps/mobile/src/design/index.ts` — export theme + ThemeProvider
- `apps/mobile/app/onboarding.tsx` — replace single screen with the paged flow host
- `apps/mobile/app/_layout.tsx` — wrap tree in `ThemeProvider`
- `apps/mobile/src/store/engineStore.ts` — add `completeOnboarding` action
- `apps/mobile/app/index.tsx` — gate new users (no profile/weights) into onboarding
- `apps/mobile/package.json` — add vitest devDeps + `test` script

---

## Task 1: Add vitest to the mobile app

**Files:**
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/vitest.config.ts`

- [ ] **Step 1: Add devDeps + test script to `apps/mobile/package.json`**

In `"scripts"` add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```
In `"devDependencies"` add:
```json
    "vitest": "^4.1.8"
```

- [ ] **Step 2: Create `apps/mobile/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

// Only the pure, framework-free logic under src/onboarding (and any future
// src/**/*.test.ts that avoids React Native imports) is unit-tested here.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Install**

Run: `npm install`
Expected: completes; `npx vitest --version` prints a 4.x version.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/vitest.config.ts package-lock.json
git commit -m "build(mobile): add vitest for pure onboarding logic"
```

---

## Task 2: Clarity theme palettes + resolveTheme (TDD)

**Files:**
- Create: `apps/mobile/src/design/theme.ts`
- Test: `apps/mobile/src/design/theme.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/design/theme.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { resolveTheme, lightTheme, darkTheme } from "./theme";

describe("resolveTheme", () => {
  it("returns the light palette for 'light'", () => {
    expect(resolveTheme("light")).toBe(lightTheme);
  });
  it("returns the dark palette for 'dark'", () => {
    expect(resolveTheme("dark")).toBe(darkTheme);
  });
  it("defaults to light when scheme is null/undefined", () => {
    expect(resolveTheme(null)).toBe(lightTheme);
    expect(resolveTheme(undefined)).toBe(lightTheme);
  });
  it("both palettes expose the same keys", () => {
    expect(Object.keys(lightTheme).sort()).toEqual(Object.keys(darkTheme).sort());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && npx vitest run src/design/theme.test.ts`
Expected: FAIL — cannot find module `./theme`.

- [ ] **Step 3: Implement `apps/mobile/src/design/theme.ts`**

```ts
/**
 * "Clarity" palettes. Content-first, calm, precise. One confident accent
 * plus a small data-viz set (calories/protein/carbs/fat). Light + dark.
 */
export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  fg: string;
  muted: string;
  border: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  // data-viz
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  trend: string;
  positive: string;
  warning: string;
  error: string;
}

export const lightTheme: Palette = {
  bg:         "#FBFAF8", // warm off-white
  surface:    "#FFFFFF",
  surfaceAlt: "#F2F1ED",
  fg:         "#1A1A18",
  muted:      "#6B6A66",
  border:     "#E6E4DE",
  accent:     "#3B5BDB", // confident indigo-blue
  accentSoft: "rgba(59,91,219,0.10)",
  onAccent:   "#FFFFFF",
  calories:   "#3B5BDB",
  protein:    "#E8590C", // warm orange
  carbs:      "#2F9E44", // green
  fat:        "#F08C00", // amber
  trend:      "#3B5BDB",
  positive:   "#2F9E44",
  warning:    "#F08C00",
  error:      "#E03131",
};

export const darkTheme: Palette = {
  bg:         "#14140F", // warm near-black
  surface:    "#1D1D17",
  surfaceAlt: "#26261E",
  fg:         "#F2F1EC",
  muted:      "#A3A199",
  border:     "#33332B",
  accent:     "#91A7FF", // lifted for dark contrast
  accentSoft: "rgba(145,167,255,0.14)",
  onAccent:   "#10131F",
  calories:   "#91A7FF",
  protein:    "#FF922B",
  carbs:      "#51CF66",
  fat:        "#FFC078",
  trend:      "#91A7FF",
  positive:   "#51CF66",
  warning:    "#FFC078",
  error:      "#FF6B6B",
};

export type ColorScheme = "light" | "dark" | null | undefined;

export const resolveTheme = (scheme: ColorScheme): Palette =>
  scheme === "dark" ? darkTheme : lightTheme;
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/mobile && npx vitest run src/design/theme.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/design/theme.ts apps/mobile/src/design/theme.test.ts
git commit -m "feat(design): add Clarity light/dark palettes + resolveTheme"
```

---

## Task 3: ThemeProvider + useTheme hook

**Files:**
- Create: `apps/mobile/src/design/ThemeProvider.tsx`
- Modify: `apps/mobile/src/design/index.ts`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Create `apps/mobile/src/design/ThemeProvider.tsx`**

```tsx
import { createContext, useContext, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { type Palette, resolveTheme } from "./theme";

const ThemeCtx = createContext<Palette>(resolveTheme("light"));

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const scheme = useColorScheme();
  return <ThemeCtx.Provider value={resolveTheme(scheme)}>{children}</ThemeCtx.Provider>;
};

/** Live palette for the current device color scheme. */
export const useTheme = (): Palette => useContext(ThemeCtx);
```

- [ ] **Step 2: Export from `apps/mobile/src/design/index.ts`**

Add these lines:
```ts
export * from "./theme";
export { ThemeProvider, useTheme } from "./ThemeProvider";
```

- [ ] **Step 3: Wrap the app tree in `apps/mobile/app/_layout.tsx`**

Replace the file body with:
```tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/auth";
import { ThemeProvider, colors } from "@/design";
import { registerConvergenceTask } from "@/lib/background";

export default function RootLayout() {
  useEffect(() => {
    void registerConvergenceTask();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: "fade",
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/design/ThemeProvider.tsx apps/mobile/src/design/index.ts apps/mobile/app/_layout.tsx
git commit -m "feat(design): ThemeProvider + useTheme, wrap app tree"
```

---

## Task 4: Re-skin base tokens to Clarity light

Existing screens import the flat `colors` object directly. Updating its *values* (not its shape) restyles them to Clarity with zero screen edits. Dark-mode retrofit of existing screens is Plan 2.

**Files:**
- Modify: `apps/mobile/src/design/tokens.ts`

- [ ] **Step 1: Replace the `colors` block in `apps/mobile/src/design/tokens.ts`**

Replace lines defining `export const colors = { ... }` with:
```ts
export const colors = {
  bg:                  "#FBFAF8",
  surface:             "#FFFFFF",
  surfaceContainer:    "#F2F1ED",
  surfaceContainerLow: "#F6F5F1",
  fg:                  "#1A1A18",
  muted:               "#6B6A66",
  border:              "#E6E4DE",
  accent:              "#3B5BDB",
  accentSoft:          "rgba(59,91,219,0.10)",
  fgSoft:              "rgba(26,26,24,0.06)",
  secondary:           "#2F9E44",
  secondaryContainer:  "#51CF66",
  error:               "#E03131",
  black:               "#000000",
} as const;
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors (shape unchanged).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/design/tokens.ts
git commit -m "feat(design): re-skin base tokens to Clarity light palette"
```

---

## Task 5: Assessment state + reducer (TDD)

The assessment is the single source of truth for everything the user enters. Pure, RN-free, fully tested.

**Files:**
- Create: `apps/mobile/src/onboarding/assessment.ts`
- Test: `apps/mobile/src/onboarding/assessment.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/onboarding/assessment.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { assessmentReducer, initialAssessment, type Assessment } from "./assessment";

describe("assessmentReducer", () => {
  it("starts with sensible metric defaults", () => {
    expect(initialAssessment.units).toBe("metric");
    expect(initialAssessment.sex).toBe("male");
    expect(initialAssessment.activityLevel).toBe("moderate");
    expect(initialAssessment.goalType).toBe("cut");
    expect(initialAssessment.dietPattern).toBe("balanced");
    expect(initialAssessment.bodyComp.method).toBe("skip");
  });

  it("patches a top-level field immutably", () => {
    const next = assessmentReducer(initialAssessment, { type: "set", patch: { heightCm: 182 } });
    expect(next.heightCm).toBe(182);
    expect(initialAssessment.heightCm).not.toBe(182);
  });

  it("patches nested body-composition state", () => {
    const next = assessmentReducer(initialAssessment, {
      type: "setBodyComp",
      patch: { method: "tape", neckCm: 38, waistCm: 84 },
    });
    expect(next.bodyComp.method).toBe("tape");
    expect(next.bodyComp.neckCm).toBe(38);
    expect(next.bodyComp.waistCm).toBe(84);
  });

  it("patches nested reminders state", () => {
    const next = assessmentReducer(initialAssessment, {
      type: "setReminders",
      patch: { logging: true, weighIn: true },
    });
    expect(next.reminders.logging).toBe(true);
    expect(next.reminders.weighIn).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && npx vitest run src/onboarding/assessment.test.ts`
Expected: FAIL — cannot find module `./assessment`.

- [ ] **Step 3: Implement `apps/mobile/src/onboarding/assessment.ts`**

```ts
import type { ActivityLevel } from "@dynamic-energy/engine";

export type UnitSystem = "metric" | "imperial";
export type Sex = "male" | "female";
export type GoalType = "cut" | "maintain" | "gain";
export type DietPattern = "balanced" | "high_protein" | "lower_carb" | "custom";
export type BodyCompMethod = "skip" | "direct" | "tape";

/** All measurements stored metric-internal (kg, cm); body-fat as a 0..1 fraction. */
export interface BodyCompState {
  method: BodyCompMethod;
  /** direct: 0..1 fraction entered by the user from a measured source. */
  directBodyFatPct: number | null;
  /** tape: cm. hip required only for female estimates. */
  neckCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
}

export interface RemindersState {
  logging: boolean;
  weighIn: boolean;
  weeklyCheckin: boolean;
  /** weigh-in cadence in days (1 = daily, 7 = weekly). */
  weighInCadenceDays: number;
}

export interface Assessment {
  units: UnitSystem;
  sex: Sex;
  /** ISO YYYY-MM-DD. */
  dateOfBirth: string;
  heightCm: number;
  currentWeightKg: number;
  bodyComp: BodyCompState;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  /** absolute kg/week magnitude the user picked (sign applied from goalType). */
  rateKgPerWeek: number;
  goalWeightKg: number | null;
  dietPattern: DietPattern;
  /** custom only: protein grams per kg bodyweight. */
  customProteinPerKg: number | null;
  /** custom only: fat as a 0..1 fraction of energy. */
  customFatPct: number | null;
  dietaryTags: string[];
  reminders: RemindersState;
}

export const initialAssessment: Assessment = {
  units: "metric",
  sex: "male",
  dateOfBirth: "1995-01-01",
  heightCm: 180,
  currentWeightKg: 80,
  bodyComp: { method: "skip", directBodyFatPct: null, neckCm: null, waistCm: null, hipCm: null },
  activityLevel: "moderate",
  goalType: "cut",
  rateKgPerWeek: 0.5,
  goalWeightKg: null,
  dietPattern: "balanced",
  customProteinPerKg: null,
  customFatPct: null,
  dietaryTags: [],
  reminders: { logging: false, weighIn: false, weeklyCheckin: false, weighInCadenceDays: 1 },
};

export type AssessmentAction =
  | { type: "set"; patch: Partial<Assessment> }
  | { type: "setBodyComp"; patch: Partial<BodyCompState> }
  | { type: "setReminders"; patch: Partial<RemindersState> };

export const assessmentReducer = (state: Assessment, action: AssessmentAction): Assessment => {
  switch (action.type) {
    case "set":
      return { ...state, ...action.patch };
    case "setBodyComp":
      return { ...state, bodyComp: { ...state.bodyComp, ...action.patch } };
    case "setReminders":
      return { ...state, reminders: { ...state.reminders, ...action.patch } };
  }
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/mobile && npx vitest run src/onboarding/assessment.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/onboarding/assessment.ts apps/mobile/src/onboarding/assessment.test.ts
git commit -m "feat(onboarding): assessment state + reducer"
```

---

## Task 6: computeStartingPlan via the engine (TDD)

Turns an `Assessment` into the displayed starting plan: resolved composition (if any), seed TDEE, safety-clamped daily target, and macro split. Uses only the engine — no reimplemented science.

**Files:**
- Create: `apps/mobile/src/onboarding/plan.ts`
- Test: `apps/mobile/src/onboarding/plan.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/onboarding/plan.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { computeStartingPlan } from "./plan";
import { initialAssessment, type Assessment } from "./assessment";

const base: Assessment = {
  ...initialAssessment,
  sex: "male",
  dateOfBirth: "1990-01-01",
  heightCm: 180,
  currentWeightKg: 80,
  activityLevel: "moderate",
  goalType: "cut",
  rateKgPerWeek: 0.5,
};

describe("computeStartingPlan", () => {
  it("computes a positive TDEE and a target below TDEE for a cut", () => {
    const p = computeStartingPlan(base, "2026-06-03");
    expect(p.tdee).toBeGreaterThan(1500);
    expect(p.dailyCalories).toBeLessThan(p.tdee); // cut lowers target
    expect(p.macros.proteinG).toBeGreaterThan(0);
    expect(p.macros.carbsG).toBeGreaterThanOrEqual(0);
    expect(p.macros.fatG).toBeGreaterThan(0);
  });

  it("raises the target above TDEE for a gain", () => {
    const p = computeStartingPlan({ ...base, goalType: "gain" }, "2026-06-03");
    expect(p.dailyCalories).toBeGreaterThan(p.tdee);
  });

  it("equals TDEE for maintenance", () => {
    const p = computeStartingPlan({ ...base, goalType: "maintain" }, "2026-06-03");
    expect(Math.round(p.dailyCalories)).toBe(Math.round(p.tdee));
  });

  it("flags clamping when the requested rate is unsafe", () => {
    const p = computeStartingPlan({ ...base, rateKgPerWeek: 5 }, "2026-06-03");
    expect(p.clamped).toBe(true);
    expect(Math.abs(p.effectiveRateKgPerWeek)).toBeLessThan(5);
  });

  it("uses lean-mass-anchored protein when a direct body-fat % is given", () => {
    const withBf: Assessment = {
      ...base,
      bodyComp: { method: "direct", directBodyFatPct: 0.15, neckCm: null, waistCm: null, hipCm: null },
    };
    const p = computeStartingPlan(withBf, "2026-06-03");
    expect(p.usedComposition).toBe(true);
    expect(p.leanMassKg).toBeGreaterThan(0);
  });

  it("degrades to no composition when tape data is incomplete", () => {
    const incomplete: Assessment = {
      ...base,
      bodyComp: { method: "tape", directBodyFatPct: null, neckCm: 38, waistCm: null, hipCm: null },
    };
    const p = computeStartingPlan(incomplete, "2026-06-03");
    expect(p.usedComposition).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && npx vitest run src/onboarding/plan.test.ts`
Expected: FAIL — cannot find module `./plan`.

- [ ] **Step 3: Implement `apps/mobile/src/onboarding/plan.ts`**

```ts
import {
  type Composition, type MacroTargets,
  cm, clampedDailyTargetFromTdee, computeMacroTargets, kg,
  resolveComposition, seedTdee, unit, years,
} from "@dynamic-energy/engine";
import { type Assessment } from "./assessment";

/**
 * Whole-years age between two calendar dates (both ISO YYYY-MM-DD).
 * Mirrors the engine's ageFromDob algorithm but works from an explicit
 * "today" date rather than a timezone, which is what this module has.
 */
const ageFromDobOnDate = (dob: string, today: string): number => {
  const [by, bm, bd] = dob.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return Math.max(0, age);
};

export interface StartingPlan {
  tdee: number;
  dailyCalories: number;
  macros: MacroTargets;
  clamped: boolean;
  /** signed kg/week actually used after safety clamp. */
  effectiveRateKgPerWeek: number;
  usedComposition: boolean;
  leanMassKg: number | null;
}

/** Signed weekly rate from the goal direction. */
export const signedRate = (a: Assessment): number => {
  const mag = Math.abs(a.rateKgPerWeek);
  if (a.goalType === "maintain") return 0;
  return a.goalType === "cut" ? -mag : mag;
};

const macroPrefs = (a: Assessment, comp: Composition | null) => {
  // Lean-mass anchored protein when composition is known; otherwise total mass.
  const leanMassKg = comp ? (comp.leanMassKg as number) : undefined;
  switch (a.dietPattern) {
    case "high_protein":
      return { proteinPerKg: leanMassKg ? 2.6 : 2.4, fatPct: 0.25, leanMassKg: leanMassKg ? kg(leanMassKg) : undefined };
    case "lower_carb":
      return { proteinPerKg: leanMassKg ? 2.4 : 2.2, fatPct: 0.40, leanMassKg: leanMassKg ? kg(leanMassKg) : undefined };
    case "custom":
      return {
        proteinPerKg: a.customProteinPerKg ?? 2.0,
        fatPct: a.customFatPct ?? 0.25,
        leanMassKg: leanMassKg ? kg(leanMassKg) : undefined,
      };
    case "balanced":
    default:
      return { proteinPerKg: leanMassKg ? 2.2 : 2.0, fatPct: 0.25, leanMassKg: leanMassKg ? kg(leanMassKg) : undefined };
  }
};

/**
 * Compute the user's starting plan from their assessment. `today` is an
 * ISO date used to derive age from date of birth.
 */
export const computeStartingPlan = (a: Assessment, today: string): StartingPlan => {
  const profile = {
    sex: a.sex,
    age: years(ageFromDobOnDate(a.dateOfBirth, today)),
    heightCm: cm(a.heightCm),
  };
  const weight = kg(a.currentWeightKg);

  const comp: Composition | null = resolveComposition({
    sex: a.sex,
    heightCm: cm(a.heightCm),
    weightKg: weight,
    neckCm: a.bodyComp.neckCm != null ? cm(a.bodyComp.neckCm) : undefined,
    waistCm: a.bodyComp.waistCm != null ? cm(a.bodyComp.waistCm) : undefined,
    hipCm: a.bodyComp.hipCm != null ? cm(a.bodyComp.hipCm) : undefined,
    directBodyFatPct:
      a.bodyComp.method === "direct" && a.bodyComp.directBodyFatPct != null
        ? unit(a.bodyComp.directBodyFatPct)
        : undefined,
  });

  const tdee = seedTdee(profile, weight, a.activityLevel, comp);
  const { target, clamped, effectiveGoal } = clampedDailyTargetFromTdee(
    tdee,
    { kgPerWeek: signedRate(a) },
    a.currentWeightKg,
  );
  const macros = computeMacroTargets(target, weight, macroPrefs(a, comp));

  return {
    tdee: tdee as number,
    dailyCalories: target as number,
    macros,
    clamped,
    effectiveRateKgPerWeek: effectiveGoal,
    usedComposition: comp !== null,
    leanMassKg: comp ? (comp.leanMassKg as number) : null,
  };
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/mobile && npx vitest run src/onboarding/plan.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/onboarding/plan.ts apps/mobile/src/onboarding/plan.test.ts
git commit -m "feat(onboarding): computeStartingPlan via engine"
```

---

## Task 7: Per-step validation (TDD)

**Files:**
- Create: `apps/mobile/src/onboarding/validation.ts`
- Test: `apps/mobile/src/onboarding/validation.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/onboarding/validation.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { isStepValid } from "./validation";
import { initialAssessment, type Assessment } from "./assessment";

const ok: Assessment = { ...initialAssessment };

describe("isStepValid", () => {
  it("about-you requires positive height/weight and a sane DOB", () => {
    expect(isStepValid("aboutYou", ok)).toBe(true);
    expect(isStepValid("aboutYou", { ...ok, heightCm: 0 })).toBe(false);
    expect(isStepValid("aboutYou", { ...ok, currentWeightKg: -1 })).toBe(false);
    expect(isStepValid("aboutYou", { ...ok, dateOfBirth: "not-a-date" })).toBe(false);
  });

  it("body-comp: skip always valid; direct needs a 0..1 fraction", () => {
    expect(isStepValid("bodyComp", { ...ok, bodyComp: { ...ok.bodyComp, method: "skip" } })).toBe(true);
    expect(isStepValid("bodyComp", { ...ok, bodyComp: { ...ok.bodyComp, method: "direct", directBodyFatPct: 0.15 } })).toBe(true);
    expect(isStepValid("bodyComp", { ...ok, bodyComp: { ...ok.bodyComp, method: "direct", directBodyFatPct: 1.5 } })).toBe(false);
    expect(isStepValid("bodyComp", { ...ok, bodyComp: { ...ok.bodyComp, method: "direct", directBodyFatPct: null } })).toBe(false);
  });

  it("body-comp tape needs neck+waist for males, plus hip for females", () => {
    const maleTape = { ...ok, sex: "male" as const, bodyComp: { ...ok.bodyComp, method: "tape" as const, neckCm: 38, waistCm: 84, hipCm: null } };
    expect(isStepValid("bodyComp", maleTape)).toBe(true);
    const femaleNoHip = { ...ok, sex: "female" as const, bodyComp: { ...ok.bodyComp, method: "tape" as const, neckCm: 32, waistCm: 70, hipCm: null } };
    expect(isStepValid("bodyComp", femaleNoHip)).toBe(false);
  });

  it("goal: maintain always valid; cut/gain need a positive rate", () => {
    expect(isStepValid("goal", { ...ok, goalType: "maintain" })).toBe(true);
    expect(isStepValid("goal", { ...ok, goalType: "cut", rateKgPerWeek: 0 })).toBe(false);
    expect(isStepValid("goal", { ...ok, goalType: "cut", rateKgPerWeek: 0.5 })).toBe(true);
  });

  it("diet custom needs protein/kg and a 0..1 fat fraction", () => {
    expect(isStepValid("diet", { ...ok, dietPattern: "balanced" })).toBe(true);
    expect(isStepValid("diet", { ...ok, dietPattern: "custom", customProteinPerKg: 2.0, customFatPct: 0.3 })).toBe(true);
    expect(isStepValid("diet", { ...ok, dietPattern: "custom", customProteinPerKg: null, customFatPct: 0.3 })).toBe(false);
    expect(isStepValid("diet", { ...ok, dietPattern: "custom", customProteinPerKg: 2.0, customFatPct: 2 })).toBe(false);
  });

  it("welcome, activity, reminders, plan are always passable", () => {
    expect(isStepValid("welcome", ok)).toBe(true);
    expect(isStepValid("activity", ok)).toBe(true);
    expect(isStepValid("reminders", ok)).toBe(true);
    expect(isStepValid("plan", ok)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && npx vitest run src/onboarding/validation.test.ts`
Expected: FAIL — cannot find module `./validation`.

- [ ] **Step 3: Implement `apps/mobile/src/onboarding/validation.ts`**

```ts
import { type Assessment } from "./assessment";

export type StepId =
  | "welcome" | "aboutYou" | "bodyComp" | "activity"
  | "goal" | "diet" | "reminders" | "plan";

const isIsoDate = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d <= new Date();
};

export const isStepValid = (step: StepId, a: Assessment): boolean => {
  switch (step) {
    case "aboutYou":
      return a.heightCm > 0 && a.currentWeightKg > 0 && isIsoDate(a.dateOfBirth);
    case "bodyComp": {
      const b = a.bodyComp;
      if (b.method === "skip") return true;
      if (b.method === "direct")
        return b.directBodyFatPct != null && b.directBodyFatPct > 0 && b.directBodyFatPct < 1;
      // tape
      const haveBase = b.neckCm != null && b.neckCm > 0 && b.waistCm != null && b.waistCm > 0;
      if (a.sex === "female") return haveBase && b.hipCm != null && b.hipCm > 0;
      return haveBase;
    }
    case "goal":
      return a.goalType === "maintain" || a.rateKgPerWeek > 0;
    case "diet":
      if (a.dietPattern !== "custom") return true;
      return (
        a.customProteinPerKg != null && a.customProteinPerKg > 0 &&
        a.customFatPct != null && a.customFatPct > 0 && a.customFatPct < 1
      );
    case "welcome":
    case "activity":
    case "reminders":
    case "plan":
      return true;
  }
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/mobile && npx vitest run src/onboarding/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/onboarding/validation.ts apps/mobile/src/onboarding/validation.test.ts
git commit -m "feat(onboarding): per-step validation"
```

---

## Task 8: Persistence payload builder (TDD)

Produces the exact argument objects the data repos expect, so the store action stays a thin caller and the mapping is unit-tested.

**Files:**
- Create: `apps/mobile/src/onboarding/persistence.ts`
- Test: `apps/mobile/src/onboarding/persistence.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/onboarding/persistence.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildOnboardingWrite } from "./persistence";
import { initialAssessment, type Assessment } from "./assessment";

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

describe("buildOnboardingWrite", () => {
  it("builds a profile payload with metric units", () => {
    const w = buildOnboardingWrite(a, "user-1", "America/New_York", "2026-06-03");
    expect(w.profile.userId).toBe("user-1");
    expect(w.profile.sex).toBe("male");
    expect(w.profile.heightCm).toBe(180);
    expect(w.profile.initialWeightKg).toBe(80);
    expect(w.profile.timezone).toBe("America/New_York");
  });

  it("builds a goal with a safety-clamped negative rate for a cut", () => {
    const w = buildOnboardingWrite(a, "user-1", "UTC", "2026-06-03");
    expect(w.goal.goalType).toBe("cut");
    expect(w.goal.rateKgPerWeek).toBeLessThan(0);
    expect(w.goal.proteinGTarget).toBeGreaterThan(0);
  });

  it("emits an initial weight entry", () => {
    const w = buildOnboardingWrite(a, "user-1", "UTC", "2026-06-03");
    expect(w.weight.userId).toBe("user-1");
    expect(w.weight.weightKg).toBe(80);
    expect(w.weight.date).toBe("2026-06-03");
  });

  it("omits body measurement when method is skip", () => {
    const w = buildOnboardingWrite(a, "user-1", "UTC", "2026-06-03");
    expect(w.bodyMeasurement).toBeNull();
  });

  it("includes a body measurement for a direct body-fat reading", () => {
    const withBf: Assessment = { ...a, bodyComp: { method: "direct", directBodyFatPct: 0.15, neckCm: null, waistCm: null, hipCm: null } };
    const w = buildOnboardingWrite(withBf, "user-1", "UTC", "2026-06-03");
    expect(w.bodyMeasurement).not.toBeNull();
    expect(w.bodyMeasurement!.bodyFatPct).toBe(0.15);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && npx vitest run src/onboarding/persistence.test.ts`
Expected: FAIL — cannot find module `./persistence`.

- [ ] **Step 3: Implement `apps/mobile/src/onboarding/persistence.ts`**

```ts
import { type Assessment } from "./assessment";
import { computeStartingPlan, signedRate } from "./plan";
import { clampGoalToSafety } from "@dynamic-energy/engine";

export interface OnboardingWrite {
  profile: {
    userId: string;
    sex: "male" | "female";
    dateOfBirth: string;
    heightCm: number;
    initialWeightKg: number;
    activityLevel: Assessment["activityLevel"];
    timezone: string;
  };
  goal: {
    userId: string;
    goalType: "cut" | "maintain" | "gain";
    rateKgPerWeek: number; // signed, safety-clamped
    startDate: string;
    proteinGTarget: number;
    carbsGTarget: number;
    fatGTarget: number;
  };
  weight: { userId: string; date: string; weightKg: number; note: string };
  bodyMeasurement:
    | null
    | {
        userId: string;
        date: string;
        neckCm: number | null;
        waistCm: number | null;
        hipCm: number | null;
        weightKg: number;
        bodyFatPct: number | null;
      };
}

export const buildOnboardingWrite = (
  a: Assessment,
  userId: string,
  timezone: string,
  today: string,
): OnboardingWrite => {
  const plan = computeStartingPlan(a, today);
  const safeRate = clampGoalToSafety(signedRate(a), a.currentWeightKg);

  const bodyMeasurement =
    a.bodyComp.method === "skip"
      ? null
      : {
          userId,
          date: today,
          neckCm: a.bodyComp.neckCm,
          waistCm: a.bodyComp.waistCm,
          hipCm: a.bodyComp.hipCm,
          weightKg: a.currentWeightKg,
          bodyFatPct: a.bodyComp.method === "direct" ? a.bodyComp.directBodyFatPct : null,
        };

  return {
    profile: {
      userId,
      sex: a.sex,
      dateOfBirth: a.dateOfBirth,
      heightCm: a.heightCm,
      initialWeightKg: a.currentWeightKg,
      activityLevel: a.activityLevel,
      timezone,
    },
    goal: {
      userId,
      goalType: a.goalType,
      rateKgPerWeek: safeRate,
      startDate: today,
      proteinGTarget: plan.macros.proteinG,
      carbsGTarget: plan.macros.carbsG,
      fatGTarget: plan.macros.fatG,
    },
    weight: { userId, date: today, weightKg: a.currentWeightKg, note: "Initial weight (onboarding)" },
    bodyMeasurement,
  };
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/mobile && npx vitest run src/onboarding/persistence.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/onboarding/persistence.ts apps/mobile/src/onboarding/persistence.test.ts
git commit -m "feat(onboarding): persistence payload builder"
```

---

## Task 9: Reminder-preference storage

Reminder prefs are captured now and persisted locally; notification *scheduling* is Plan 2.

**Files:**
- Create: `apps/mobile/src/onboarding/reminders.ts`

- [ ] **Step 1: Implement `apps/mobile/src/onboarding/reminders.ts`**

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type RemindersState } from "./assessment";

const KEY = "reminders.prefs.v1";

export const saveReminderPrefs = async (prefs: RemindersState): Promise<void> => {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
};

export const loadReminderPrefs = async (): Promise<RemindersState | null> => {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RemindersState;
  } catch {
    return null;
  }
};
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/onboarding/reminders.ts
git commit -m "feat(onboarding): local reminder-preference storage"
```

---

## Task 10: `completeOnboarding` store action

Wires the tested payload builder to the real repos. Persists profile, goal+macros, optional body measurement, and the initial weight, saves reminder prefs, then hydrates.

**Files:**
- Modify: `apps/mobile/src/store/engineStore.ts`

- [ ] **Step 1: Add imports near the top of `engineStore.ts`**

After the existing `import { repos, supabase } from "@/lib/supabase";` line add:
```ts
import { isoDate, localDateInTimezone } from "@dynamic-energy/engine";
import { type Assessment } from "@/onboarding/assessment";
import { buildOnboardingWrite } from "@/onboarding/persistence";
import { saveReminderPrefs } from "@/onboarding/reminders";
```
(`isoDate`/`localDateInTimezone` may already be imported — if so, don't duplicate.)

- [ ] **Step 2: Declare the action in the `EngineState` interface**

After the `setProfile: (...) => Promise<void>;` declaration, add:
```ts
  /** Persist a full onboarding assessment, then hydrate. */
  completeOnboarding: (assessment: Assessment) => Promise<void>;
```

- [ ] **Step 3: Implement the action in the store body**

Immediately after the `setProfile: async (input) => { ... },` implementation, add:
```ts
  completeOnboarding: async (assessment) => {
    const userId = get().userId;
    if (!userId) throw new Error("Not signed in");
    const tz =
      assessment ? (Intl?.DateTimeFormat?.().resolvedOptions().timeZone ?? "UTC") : "UTC";
    const today = localDateInTimezone(tz);
    const w = buildOnboardingWrite(assessment, userId, tz, today);

    await repos.profile.upsert({
      userId: w.profile.userId,
      sex: w.profile.sex,
      dateOfBirth: w.profile.dateOfBirth,
      heightCm: w.profile.heightCm,
      initialWeightKg: w.profile.initialWeightKg,
      activityLevel: w.profile.activityLevel,
      timezone: w.profile.timezone,
    });

    await repos.goal.setActive({
      userId: w.goal.userId,
      goalType: w.goal.goalType,
      rateKgPerWeek: w.goal.rateKgPerWeek,
      startDate: isoDate(w.goal.startDate),
      proteinGTarget: w.goal.proteinGTarget,
      carbsGTarget: w.goal.carbsGTarget,
      fatGTarget: w.goal.fatGTarget,
    });

    await repos.weight.log({
      userId: w.weight.userId,
      date: isoDate(w.weight.date),
      weightKg: w.weight.weightKg,
      note: w.weight.note,
    });

    if (w.bodyMeasurement) {
      await repos.bodyMeasurement.log({
        userId: w.bodyMeasurement.userId,
        date: isoDate(w.bodyMeasurement.date),
        neckCm: w.bodyMeasurement.neckCm,
        waistCm: w.bodyMeasurement.waistCm,
        hipCm: w.bodyMeasurement.hipCm,
        weightKg: w.bodyMeasurement.weightKg,
        bodyFatPct: w.bodyMeasurement.bodyFatPct,
      });
    }

    await saveReminderPrefs(assessment.reminders);
    await get().hydrate(userId);
  },
```

Note: `goalRepo.setActive` already accepts `proteinGTarget`/`carbsGTarget`/`fatGTarget` (see `packages/data/src/repositories.ts`). `clampGoalToSafety` is applied inside `buildOnboardingWrite`, and `goalRepo.setActive` applies `Math.abs(rate)` — so pass the magnitude. **Adjust:** in `persistence.ts` the goal rate is signed for storage clarity, but `goalRepo.setActive` stores `Math.abs(rateKgPerWeek)` with the sign implied by `goalType`. Pass `Math.abs(w.goal.rateKgPerWeek)`:

```ts
      rateKgPerWeek: Math.abs(w.goal.rateKgPerWeek),
```
(Replace the `rateKgPerWeek: w.goal.rateKgPerWeek,` line in the `setActive` call above with this.)

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/store/engineStore.ts
git commit -m "feat(store): completeOnboarding action persists full assessment"
```

---

## Task 11: Shared onboarding step UI primitives

Small, theme-aware building blocks reused by every step. Built against `useTheme()` so onboarding is dark-ready.

**Files:**
- Create: `apps/mobile/src/onboarding/ui.tsx`

- [ ] **Step 1: Implement `apps/mobile/src/onboarding/ui.tsx`**

```tsx
import { type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "@/design";
import { haptic } from "@/lib/haptics";

export const StepHeader = ({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) => {
  const t = useTheme();
  return (
    <View style={{ gap: 6, marginBottom: 24 }}>
      <Text style={{ color: t.accent, fontSize: 12, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase" }}>{eyebrow}</Text>
      <Text style={{ color: t.fg, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 }}>{title}</Text>
      {subtitle ? <Text style={{ color: t.muted, fontSize: 15, lineHeight: 22 }}>{subtitle}</Text> : null}
    </View>
  );
};

export const Field = ({ label, value, onChangeText, unit, keyboardType = "decimal-pad" }: {
  label: string; value: string; onChangeText: (v: string) => void; unit?: string;
  keyboardType?: "decimal-pad" | "number-pad" | "default";
}) => {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: "500" }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, borderBottomWidth: 1, borderBottomColor: t.border, paddingBottom: 6 }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholderTextColor={t.muted}
          style={{ flex: 1, color: t.fg, fontSize: 28, fontWeight: "700", padding: 0 }}
        />
        {unit ? <Text style={{ color: t.muted, fontSize: 14, fontWeight: "600" }}>{unit}</Text> : null}
      </View>
    </View>
  );
};

export function Segment<T extends string>({ options, value, onChange }: {
  options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: t.surfaceAlt, borderRadius: 12, padding: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { haptic.light(); onChange(o.value); }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center", backgroundColor: active ? t.surface : "transparent" }}
          >
            <Text style={{ color: active ? t.fg : t.muted, fontSize: 14, fontWeight: active ? "700" : "500" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SelectableRow({ title, detail, trailing, selected, onPress }: {
  title: string; detail?: string; trailing?: string; selected: boolean; onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => { haptic.light(); onPress(); }}
      style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: 16, borderRadius: 14, borderWidth: 1.5,
        borderColor: selected ? t.accent : t.border,
        backgroundColor: selected ? t.accentSoft : t.surface,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: selected ? t.accent : t.fg, fontSize: 15, fontWeight: "600" }}>{title}</Text>
        {detail ? <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>{detail}</Text> : null}
      </View>
      {trailing ? <Text style={{ color: selected ? t.accent : t.muted, fontSize: 13, fontWeight: "600" }}>{trailing}</Text> : null}
    </Pressable>
  );
}

export const PrimaryButton = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => { if (!disabled) { haptic.light(); onPress(); } }}
      style={{ backgroundColor: t.accent, opacity: disabled ? 0.4 : 1, borderRadius: 999, paddingVertical: 16, alignItems: "center" }}
    >
      <Text style={{ color: t.onAccent, fontSize: 16, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
};

export const GhostButton = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const t = useTheme();
  return (
    <Pressable onPress={() => { haptic.light(); onPress(); }} style={{ paddingVertical: 16, alignItems: "center" }}>
      <Text style={{ color: t.muted, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
};

export const ProgressBar = ({ step, total }: { step: number; total: number }) => {
  const t = useTheme();
  return (
    <View style={{ height: 4, backgroundColor: t.surfaceAlt, borderRadius: 999, overflow: "hidden" }}>
      <View style={{ height: 4, width: `${Math.round((step / total) * 100)}%`, backgroundColor: t.accent, borderRadius: 999 }} />
    </View>
  );
};

export const Stack = ({ children, gap = 16 }: { children: ReactNode; gap?: number }) => (
  <View style={{ gap }}>{children}</View>
);
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/onboarding/ui.tsx
git commit -m "feat(onboarding): shared theme-aware step UI primitives"
```

---

## Task 12: Step components — Welcome, About You, Body Composition

Each step is a controlled component: it receives the current `Assessment` and a `dispatch`, and renders only its own inputs.

**Files:**
- Create: `apps/mobile/src/onboarding/steps/StepWelcome.tsx`
- Create: `apps/mobile/src/onboarding/steps/StepAboutYou.tsx`
- Create: `apps/mobile/src/onboarding/steps/StepBodyComposition.tsx`

- [ ] **Step 1: `StepWelcome.tsx`**

```tsx
import { View } from "react-native";
import { StepHeader } from "../ui";

export const StepWelcome = () => (
  <View>
    <StepHeader
      eyebrow="Welcome"
      title="Targets that adapt to your real metabolism"
      subtitle="Answer a few questions and we'll set your starting calories and macros. As you log, your targets adjust automatically — no recalculating by hand."
    />
  </View>
);
```

- [ ] **Step 2: `StepAboutYou.tsx`**

```tsx
import { View } from "react-native";
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from "@dynamic-energy/engine";
import { type Assessment, type AssessmentAction } from "../assessment";
import { Field, Segment, StepHeader, Stack } from "../ui";

export const StepAboutYou = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  const ftin = cmToFtIn(a.heightCm || 0);
  const weightLb = kgToLb(a.currentWeightKg || 0).toFixed(1);

  return (
    <View>
      <StepHeader eyebrow="Step 1" title="About you" subtitle="These set your baseline metabolic rate." />
      <Stack gap={24}>
        <Segment<Assessment["sex"]>
          options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]}
          value={a.sex}
          onChange={(sex) => set({ sex })}
        />
        <Segment<Assessment["units"]>
          options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]}
          value={a.units}
          onChange={(units) => set({ units })}
        />
        <Field
          label="Date of birth (YYYY-MM-DD)"
          value={a.dateOfBirth}
          keyboardType="default"
          onChangeText={(dateOfBirth) => set({ dateOfBirth })}
        />
        {a.units === "metric" ? (
          <>
            <Field label="Height" unit="cm" value={String(a.heightCm)} onChangeText={(v) => set({ heightCm: Number(v) || 0 })} />
            <Field label="Current weight" unit="kg" value={String(a.currentWeightKg)} onChangeText={(v) => set({ currentWeightKg: Number(v) || 0 })} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Field label="Height" unit="ft" keyboardType="number-pad" value={String(ftin.feet)}
                  onChangeText={(v) => set({ heightCm: ftInToCm(Number(v) || 0, ftin.inches) })} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label=" " unit="in" keyboardType="number-pad" value={String(ftin.inches)}
                  onChangeText={(v) => set({ heightCm: ftInToCm(ftin.feet, Math.min(11, Number(v) || 0)) })} />
              </View>
            </View>
            <Field label="Current weight" unit="lb" value={weightLb} onChangeText={(v) => set({ currentWeightKg: lbToKg(Number(v) || 0) })} />
          </>
        )}
      </Stack>
    </View>
  );
};
```

- [ ] **Step 3: `StepBodyComposition.tsx`**

```tsx
import { View } from "react-native";
import { type Assessment, type AssessmentAction, type BodyCompMethod } from "../assessment";
import { Field, SelectableRow, StepHeader, Stack } from "../ui";

export const StepBodyComposition = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const setBc = (patch: Partial<Assessment["bodyComp"]>) => dispatch({ type: "setBodyComp", patch });
  const choose = (method: BodyCompMethod) => dispatch({ type: "setBodyComp", patch: { method } });

  return (
    <View>
      <StepHeader
        eyebrow="Step 2 · Optional"
        title="Body composition"
        subtitle="If you have a measured body-fat %, we'll use a more accurate formula. We never ask you to guess — skip if you're not sure."
      />
      <Stack gap={12}>
        <SelectableRow title="I have a measured body-fat %" detail="From a DEXA scan, smart scale, or calipers"
          selected={a.bodyComp.method === "direct"} onPress={() => choose("direct")} />
        <SelectableRow title="Measure with a tape" detail="We'll estimate using the U.S. Navy method"
          selected={a.bodyComp.method === "tape"} onPress={() => choose("tape")} />
        <SelectableRow title="Skip for now" detail="We'll use the standard formula"
          selected={a.bodyComp.method === "skip"} onPress={() => choose("skip")} />

        {a.bodyComp.method === "direct" && (
          <Field label="Body fat %" unit="%" value={a.bodyComp.directBodyFatPct != null ? String(Math.round(a.bodyComp.directBodyFatPct * 100)) : ""}
            onChangeText={(v) => setBc({ directBodyFatPct: v ? Number(v) / 100 : null })} />
        )}
        {a.bodyComp.method === "tape" && (
          <Stack gap={16}>
            <Field label="Neck" unit="cm" value={a.bodyComp.neckCm != null ? String(a.bodyComp.neckCm) : ""}
              onChangeText={(v) => setBc({ neckCm: v ? Number(v) : null })} />
            <Field label="Waist" unit="cm" value={a.bodyComp.waistCm != null ? String(a.bodyComp.waistCm) : ""}
              onChangeText={(v) => setBc({ waistCm: v ? Number(v) : null })} />
            {a.sex === "female" && (
              <Field label="Hip" unit="cm" value={a.bodyComp.hipCm != null ? String(a.bodyComp.hipCm) : ""}
                onChangeText={(v) => setBc({ hipCm: v ? Number(v) : null })} />
            )}
          </Stack>
        )}
      </Stack>
    </View>
  );
};
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/onboarding/steps/StepWelcome.tsx apps/mobile/src/onboarding/steps/StepAboutYou.tsx apps/mobile/src/onboarding/steps/StepBodyComposition.tsx
git commit -m "feat(onboarding): welcome, about-you, body-composition steps"
```

---

## Task 13: Step components — Activity, Goal, Diet, Reminders

**Files:**
- Create: `apps/mobile/src/onboarding/steps/StepActivity.tsx`
- Create: `apps/mobile/src/onboarding/steps/StepGoal.tsx`
- Create: `apps/mobile/src/onboarding/steps/StepDiet.tsx`
- Create: `apps/mobile/src/onboarding/steps/StepReminders.tsx`

- [ ] **Step 1: `StepActivity.tsx`**

```tsx
import { View } from "react-native";
import { ACTIVITY_LEVELS } from "@dynamic-energy/engine";
import { type Assessment, type AssessmentAction } from "../assessment";
import { SelectableRow, StepHeader, Stack } from "../ui";

export const StepActivity = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => (
  <View>
    <StepHeader eyebrow="Step 3" title="Your lifestyle" subtitle="This sets your starting calorie estimate. We refine it from your real data each week." />
    <Stack gap={12}>
      {ACTIVITY_LEVELS.map((o) => (
        <SelectableRow
          key={o.key}
          title={o.label}
          detail={o.detail}
          selected={a.activityLevel === o.key}
          onPress={() => dispatch({ type: "set", patch: { activityLevel: o.key } })}
        />
      ))}
    </Stack>
  </View>
);
```

- [ ] **Step 2: `StepGoal.tsx`**

```tsx
import { View } from "react-native";
import { kgToLb, lbToKg } from "@dynamic-energy/engine";
import { type Assessment, type AssessmentAction } from "../assessment";
import { Field, Segment, StepHeader, Stack } from "../ui";

export const StepGoal = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  const metric = a.units === "metric";
  const rateDisplay = metric ? String(a.rateKgPerWeek) : kgToLb(a.rateKgPerWeek).toFixed(2);
  const goalWeightDisplay =
    a.goalWeightKg == null ? "" : metric ? String(a.goalWeightKg) : kgToLb(a.goalWeightKg).toFixed(1);

  return (
    <View>
      <StepHeader eyebrow="Step 4" title="Your goal" subtitle="We'll keep your rate within a safe range." />
      <Stack gap={24}>
        <Segment<Assessment["goalType"]>
          options={[{ value: "cut", label: "Lose" }, { value: "maintain", label: "Maintain" }, { value: "gain", label: "Gain" }]}
          value={a.goalType}
          onChange={(goalType) => set({ goalType })}
        />
        {a.goalType !== "maintain" && (
          <>
            <Field
              label="Weekly rate"
              unit={metric ? "kg/wk" : "lb/wk"}
              value={rateDisplay}
              onChangeText={(v) => set({ rateKgPerWeek: metric ? Number(v) || 0 : lbToKg(Number(v) || 0) })}
            />
            <Field
              label="Goal weight (optional)"
              unit={metric ? "kg" : "lb"}
              value={goalWeightDisplay}
              onChangeText={(v) => set({ goalWeightKg: v ? (metric ? Number(v) : lbToKg(Number(v))) : null })}
            />
          </>
        )}
      </Stack>
    </View>
  );
};
```

- [ ] **Step 3: `StepDiet.tsx`**

```tsx
import { View } from "react-native";
import { type Assessment, type AssessmentAction, type DietPattern } from "../assessment";
import { Field, SelectableRow, StepHeader, Stack } from "../ui";

const PATTERNS: { value: DietPattern; title: string; detail: string }[] = [
  { value: "balanced", title: "Balanced", detail: "Even split, moderate protein" },
  { value: "high_protein", title: "High protein", detail: "Prioritize protein for muscle" },
  { value: "lower_carb", title: "Lower carb", detail: "More fat, fewer carbs" },
  { value: "custom", title: "Custom", detail: "Set protein and fat yourself" },
];

export const StepDiet = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const set = (patch: Partial<Assessment>) => dispatch({ type: "set", patch });
  return (
    <View>
      <StepHeader eyebrow="Step 5" title="Dietary preference" subtitle="This shapes how we split your calories into macros." />
      <Stack gap={12}>
        {PATTERNS.map((p) => (
          <SelectableRow key={p.value} title={p.title} detail={p.detail}
            selected={a.dietPattern === p.value} onPress={() => set({ dietPattern: p.value })} />
        ))}
        {a.dietPattern === "custom" && (
          <Stack gap={16}>
            <Field label="Protein" unit="g/kg" value={a.customProteinPerKg != null ? String(a.customProteinPerKg) : ""}
              onChangeText={(v) => set({ customProteinPerKg: v ? Number(v) : null })} />
            <Field label="Fat" unit="% of calories" value={a.customFatPct != null ? String(Math.round(a.customFatPct * 100)) : ""}
              onChangeText={(v) => set({ customFatPct: v ? Number(v) / 100 : null })} />
          </Stack>
        )}
      </Stack>
    </View>
  );
};
```

- [ ] **Step 4: `StepReminders.tsx`**

```tsx
import { View } from "react-native";
import { type Assessment, type AssessmentAction } from "../assessment";
import { SelectableRow, StepHeader, Stack } from "../ui";

export const StepReminders = ({ a, dispatch }: { a: Assessment; dispatch: (x: AssessmentAction) => void }) => {
  const r = a.reminders;
  return (
    <View>
      <StepHeader eyebrow="Step 6 · Optional" title="Reminders" subtitle="We'll nudge you only for what you turn on." />
      <Stack gap={12}>
        <SelectableRow title="Daily logging reminder" detail="A gentle nudge to log your food" trailing={r.logging ? "On" : "Off"}
          selected={r.logging} onPress={() => dispatch({ type: "setReminders", patch: { logging: !r.logging } })} />
        <SelectableRow title="Weigh-in reminder" detail="Best taken first thing in the morning" trailing={r.weighIn ? "On" : "Off"}
          selected={r.weighIn} onPress={() => dispatch({ type: "setReminders", patch: { weighIn: !r.weighIn } })} />
        <SelectableRow title="Weekly check-in" detail="Review and accept your adjusted targets" trailing={r.weeklyCheckin ? "On" : "Off"}
          selected={r.weeklyCheckin} onPress={() => dispatch({ type: "setReminders", patch: { weeklyCheckin: !r.weeklyCheckin } })} />
      </Stack>
    </View>
  );
};
```

- [ ] **Step 5: Typecheck + commit**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.
```bash
git add apps/mobile/src/onboarding/steps/StepActivity.tsx apps/mobile/src/onboarding/steps/StepGoal.tsx apps/mobile/src/onboarding/steps/StepDiet.tsx apps/mobile/src/onboarding/steps/StepReminders.tsx
git commit -m "feat(onboarding): activity, goal, diet, reminders steps"
```

---

## Task 14: Step component — Starting Plan (payoff)

Renders the engine-computed plan from the live assessment.

**Files:**
- Create: `apps/mobile/src/onboarding/steps/StepPlan.tsx`

- [ ] **Step 1: `StepPlan.tsx`**

```tsx
import { View, Text } from "react-native";
import { localDateInTimezone } from "@dynamic-energy/engine";
import { useTheme } from "@/design";
import { type Assessment } from "../assessment";
import { computeStartingPlan } from "../plan";
import { StepHeader, Stack } from "../ui";

const Metric = ({ label, value, color }: { label: string; value: string; color: string }) => {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ color, fontSize: 22, fontWeight: "800" }}>{value}</Text>
    </View>
  );
};

export const StepPlan = ({ a }: { a: Assessment }) => {
  const t = useTheme();
  const today = localDateInTimezone(Intl?.DateTimeFormat?.().resolvedOptions().timeZone ?? "UTC");
  const plan = computeStartingPlan(a, today);

  return (
    <View>
      <StepHeader eyebrow="Your starting plan" title={`${Math.round(plan.dailyCalories).toLocaleString()} calories / day`}
        subtitle="These are your starting targets. They'll adapt automatically as you log." />
      <View style={{ backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 20, gap: 20 }}>
        <View style={{ flexDirection: "row" }}>
          <Metric label="Protein" value={`${plan.macros.proteinG} g`} color={t.protein} />
          <Metric label="Carbs" value={`${plan.macros.carbsG} g`} color={t.carbs} />
          <Metric label="Fat" value={`${plan.macros.fatG} g`} color={t.fat} />
        </View>
        <Stack gap={6}>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Estimated daily energy use: {Math.round(plan.tdee).toLocaleString()} kcal
            {plan.usedComposition ? " · using your body composition" : ""}.
          </Text>
          {plan.clamped && (
            <Text style={{ color: t.warning, fontSize: 13 }}>
              We adjusted your rate to a safer {Math.abs(plan.effectiveRateKgPerWeek).toFixed(2)} kg/week.
            </Text>
          )}
        </Stack>
      </View>
    </View>
  );
};
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.
```bash
git add apps/mobile/src/onboarding/steps/StepPlan.tsx
git commit -m "feat(onboarding): starting-plan payoff step"
```

---

## Task 15: Onboarding host (paged flow)

Replaces the old single-screen onboarding with a stepper that walks the steps, gates Next on validity, and commits via `completeOnboarding`.

**Files:**
- Modify (replace): `apps/mobile/app/onboarding.tsx`

- [ ] **Step 1: Replace `apps/mobile/app/onboarding.tsx` entirely**

```tsx
import { useReducer, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/design";
import { haptic } from "@/lib/haptics";
import { useEngine } from "@/store/engineStore";
import { assessmentReducer, initialAssessment } from "@/onboarding/assessment";
import { isStepValid, type StepId } from "@/onboarding/validation";
import { GhostButton, PrimaryButton, ProgressBar } from "@/onboarding/ui";
import { StepWelcome } from "@/onboarding/steps/StepWelcome";
import { StepAboutYou } from "@/onboarding/steps/StepAboutYou";
import { StepBodyComposition } from "@/onboarding/steps/StepBodyComposition";
import { StepActivity } from "@/onboarding/steps/StepActivity";
import { StepGoal } from "@/onboarding/steps/StepGoal";
import { StepDiet } from "@/onboarding/steps/StepDiet";
import { StepReminders } from "@/onboarding/steps/StepReminders";
import { StepPlan } from "@/onboarding/steps/StepPlan";

const ORDER: StepId[] = ["welcome", "aboutYou", "bodyComp", "activity", "goal", "diet", "reminders", "plan"];

export default function Onboarding() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const completeOnboarding = useEngine((s) => s.completeOnboarding);

  const [a, dispatch] = useReducer(assessmentReducer, initialAssessment);
  const [index, setIndex] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = ORDER[index]!;
  const isLast = index === ORDER.length - 1;
  const canAdvance = isStepValid(step, a);

  const next = async () => {
    if (!canAdvance) return;
    if (!isLast) { setIndex((i) => i + 1); return; }
    setCommitting(true);
    setError(null);
    try {
      await completeOnboarding(a);
      haptic.success();
      router.replace("/command");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      haptic.error();
      setCommitting(false);
    }
  };

  const back = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
        <ProgressBar step={index + 1} total={ORDER.length} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {step === "welcome" && <StepWelcome />}
        {step === "aboutYou" && <StepAboutYou a={a} dispatch={dispatch} />}
        {step === "bodyComp" && <StepBodyComposition a={a} dispatch={dispatch} />}
        {step === "activity" && <StepActivity a={a} dispatch={dispatch} />}
        {step === "goal" && <StepGoal a={a} dispatch={dispatch} />}
        {step === "diet" && <StepDiet a={a} dispatch={dispatch} />}
        {step === "reminders" && <StepReminders a={a} dispatch={dispatch} />}
        {step === "plan" && <StepPlan a={a} />}
        {error && <Text style={{ color: t.error, fontSize: 14, marginTop: 16 }}>{error}</Text>}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 12, gap: 4 }}>
        <PrimaryButton
          label={isLast ? (committing ? "Setting up…" : "Start tracking") : "Continue"}
          onPress={next}
          disabled={!canAdvance || committing}
        />
        {index > 0 && <GhostButton label="Back" onPress={back} />}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/onboarding.tsx
git commit -m "feat(onboarding): paged assessment flow replaces single screen"
```

---

## Task 16: Route new users into onboarding

Ensure a freshly signed-in user with no profile/weights lands in onboarding, not an empty Command screen.

**Files:**
- Modify: `apps/mobile/app/index.tsx`

- [ ] **Step 1: Inspect the current routing**

Run: `cat apps/mobile/app/index.tsx`
Identify where it decides between sign-in / command after `useAuth()` resolves a session.

- [ ] **Step 2: Add an onboarding gate**

In `apps/mobile/app/index.tsx`, after a session is confirmed present, check for an existing profile + at least one weight entry before routing to `/command`; otherwise route to `/onboarding`. Use this effect (adapt variable names to the file's existing `useAuth`/router usage):

```tsx
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { repos } from "@/lib/supabase";
import { isoDate } from "@dynamic-energy/engine";

// inside the component, after `const { session, userId } = useAuth();`
const router = useRouter();
const [decided, setDecided] = useState(false);

useEffect(() => {
  if (session === undefined) return;            // still hydrating
  if (session === null) { router.replace("/sign-in"); return; }
  if (!userId) return;
  void (async () => {
    const since = isoDate("1970-01-01");
    const [account, weights] = await Promise.all([
      repos.profile.getAccount(userId),
      repos.weight.listSince(userId, since),
    ]);
    const onboarded = !!account && weights.length > 0;
    router.replace(onboarded ? "/command" : "/onboarding");
    setDecided(true);
  })();
}, [session, userId, router]);
```

Keep whatever loading UI the file already renders while `!decided`.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/index.tsx
git commit -m "feat(onboarding): gate un-onboarded users into the assessment flow"
```

---

## Task 17: Full test + manual smoke

**Files:** none (verification)

- [ ] **Step 1: Run the full mobile unit suite**

Run: `cd apps/mobile && npm test`
Expected: all suites pass (theme, assessment, plan, validation, persistence).

- [ ] **Step 2: Typecheck the whole app**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual smoke in Expo Go**

Run: `cd apps/mobile && npx expo start` (open Terminal; scan QR).
Verify, signed in as a fresh user:
- Landing routes to the new onboarding (progress bar at top).
- Each step advances only when valid (e.g. About You blocks empty height).
- Body-composition "Skip / direct / tape" branches render correctly; female tape shows a Hip field.
- The Plan step shows non-zero calories + macros, and warns if you set an unsafe rate (e.g. 5 kg/wk).
- "Start tracking" lands on Command with real numbers (not the empty state).
- Light vs dark: toggle the device appearance — onboarding follows the system scheme.

- [ ] **Step 4: Commit any fixes found during smoke**

```bash
git add -A && git commit -m "fix(onboarding): address smoke-test findings"
```
(Skip if nothing needed.)

---

## Self-Review

**Spec coverage:**
- §2 brand pivot → Tasks 2–4 (Clarity tokens/theme), and onboarding UI built in the new language (Tasks 11–15). ✓
- §6 science invisible/deep → friendly labels in steps; the math lives in the engine via `computeStartingPlan`. ✓
- §7 full scientific onboarding (sign-in, about you, body comp w/ measured-only rule, activity, goal+goal weight+safe rate, diet, reminders, starting plan) → Tasks 5–16. ✓ (Sign-in already exists; gate added in Task 16.)
- §8 design language (light+dark, tabular numbers, calm) → theme + ui primitives. ✓
- §11 milestone build order → this plan is steps 1–2 of the milestone (design system + onboarding); Today/Log/tab-shell are Plan 2 (noted). ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✓

**Type consistency:** `Assessment`, `AssessmentAction`, `computeStartingPlan`, `buildOnboardingWrite`, `StepId`, `isStepValid`, `resolveTheme`, `useTheme` are defined once and used consistently. Engine calls match verified signatures (`seedTdee`, `clampedDailyTargetFromTdee`, `computeMacroTargets`, `resolveComposition`, `ageFromDob`, `clampGoalToSafety`). `goalRepo.setActive` macro params confirmed present. ✓

**Known follow-ups (Plan 2):** reminder notification scheduling; dark-mode retrofit of existing screens (Command/Trends); Today + Log redesign; tab-bar shell.
