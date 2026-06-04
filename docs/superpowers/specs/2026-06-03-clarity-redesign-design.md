# Dynamic Energy Tracker — "Clarity" Product & Design Brief

**Date:** 2026-06-03
**Status:** Approved (pending written-spec review)
**Author:** Eliander Rosales + Claude

---

## 1. North Star

> A food tracker for serious enthusiasts that's as clean and calm as the best consumer apps, but quietly smarter than all of them — your targets adapt to your real metabolism automatically, and the science is there when you want it, invisible when you don't.

**Positioning in one line:** *"MacroFactor's intelligence, with a faster everyday experience."*

---

## 2. Brand Decision — Retiring "Dense Matrix"

The repo currently holds **two contradictory design systems**, and the apps are built in different ones:

- **"Dense Matrix"** (`DESIGN.md`, PRD) — Obsidian + Tactical Amber, mono everything, sharp 2px geometry, military/flight-computer voice ("BAYESIAN AUDIT", "ENERGY FLUX RUNWAY"). Used by the mobile app.
- **"Modern Fluidity"** (`design/stitch/design_system.json`) — deep-midnight blue, electric-blue/cyan, heavy glassmorphism, Geist, "Trajectory/journey" voice. Used by the web app.

Both are *style-first*. Neither matches the apps this product is inspired by (MyFitnessPal, MacroFactor, Fitia, Lose It, FatSecret) — all of which are clean, warm, approachable, and *content-first*.

**Decision:** Retire Dense Matrix and the heavy glassmorphism. Adopt a new **content-first** direction called **"Clarity."**

**Clarity = calm, confident, precise.** Numbers remain the heroes, but presented warmly rather than as mission-critical telemetry. Reference points: MacroFactor's restraint, Oura's calm, Linear's precision.

| Was (Dense Matrix) | Becomes (Clarity) |
|---|---|
| "ENERGY FLUX RUNWAY" | "Calories left" / "Today's energy" |
| "BAYESIAN AUDIT" | "Weekly check-in" |
| "Convergence in 4.2 days" | "Dialing in your targets — 4 days left" |
| Obsidian + Tactical Amber only | Warm neutral base, one confident accent, supportive data-viz palette; **light + dark** |
| Mono everywhere, sharp 2px | Clean sans (numbers tabular), comfortable radii, generous spacing |
| Mission-critical voice | Calm, plain-spoken, encouraging without being cheesy |

Exact tokens (palette hex, type ramp, spacing scale) are defined in the first milestone using the `design-tokens` skill. This brief sets the philosophy, not the values.

---

## 3. Target User & Jobs-to-be-Done

**Primary user:** the serious fitness/physique enthusiast. Tracks most days, understands macros, cares about body composition, and has been let down by clunky trackers (MFP) or wants smarter targets (the MacroFactor draw).

Core jobs:
1. *"Log what I ate in under 10 seconds."*
2. *"Tell me if I'm on track today"* — at a glance.
3. *"Adjust my targets for me as my body changes"* — without doing the math.
4. *"Show me the trend, not the daily noise."*

---

## 4. The Three Pillars (balanced)

1. **Fast, trustworthy logging** — quick search, barcode scan, recents/frequents, saved meals/recipes, painless portions. The daily make-or-break.
2. **Adaptive intelligence** — the existing dynamic-TDEE engine, surfaced as automatic weekly target updates plus a calm "why."
3. **Body & progress** — weight *trend* (not raw scale noise), body composition, measurements, photos, the long arc.

These are weighted equally; no single pillar dominates the product.

---

## 5. Information Architecture

A familiar bottom tab bar (mobile-first). Innovation goes into *quality*, not novel navigation — enthusiasts expect MFP/MacroFactor-style structure.

- **Today** — home: calories/macros left, today's log, quick-add. Opened many times daily.
- **Log** — the fast food-logging flow (search / scan / recents).
- **Trends** — weight trend, intake adherence, TDEE over time, body composition.
- **Coach** — the adaptive layer: weekly check-in, target changes, the "deep on demand" science.
- **Profile** — goals, settings, units, account.

---

## 6. Science: Invisible by Default, Deep on Demand

Structural rule: **every science concept has a friendly default label and a deep-dive behind one tap.**

- **Default surface:** plain targets — "2,340 cal left," "Protein 120/180g." No jargon, no Greek letters.
- **One tap deeper:** "Your target went up 90 cal this week — your metabolism's running a bit hotter. See why →"
- **Power-user layer (Coach tab):** full picture — TDEE history, confidence, weekly audit, the data behind each adjustment. Opt-in, never forced.

### Engine ↔ UI contract (preserved)

The engine package (`packages/engine`) stays framework-agnostic and emits raw SI numbers (kg, kcal, kcal/day). The UI is the only place where numbers are formatted, units localized (kg↔lb, kcal↔kJ), and friendly language applied. The engine never returns display strings. The "Clarity" vocabulary is a UI layer, not engine output.

---

## 7. First-Run Onboarding — Full Scientific Assessment

A guided setup that produces a genuinely individualized starting point, then hands off to a populated Today screen. Plain-language on the surface; real science underneath. It writes the user's profile, goal, body-composition baseline (if provided), and initial weight, then calls the engine to compute starting targets.

**Design principle (from the engine's own design):** we never ask the user to *guess* a body-fat number — guessing injects more error than it removes. Body composition is collected only when it can be *measured* (DEXA / smart scale / calipers) or *derived from tape* (U.S. Navy method). Otherwise we use Mifflin–St Jeor and say so plainly.

### Steps

1. **Welcome** — one screen, the value promise ("Targets that adapt to your real metabolism").
2. **Sign in** — Google or email (needed up front to persist the profile).
3. **About you** — biological sex, date of birth, height, current weight, units (metric/imperial).
   *Feeds:* BMR via Mifflin–St Jeor (`mifflinStJeor`), age via `ageFromDob`.
4. **Body composition (optional, sharpens accuracy)** — three clearly-labeled paths:
   - *"I have a measured body-fat %"* (DEXA / smart scale / calipers) → direct value.
   - *"Measure with a tape"* → neck, waist (+ hip for females) → U.S. Navy method (`navyBodyFatPct` → `leanMass`).
   - *"Skip"* → use Mifflin–St Jeor.
   *Feeds:* when present, RMR uses Katch–McArdle (`katchMcArdle` via `resolveComposition` / `restingEnergy`); protein anchors to lean mass.
5. **Lifestyle / activity level** — Sedentary → Extra Active, each with the engine's plain descriptions (`ACTIVITY_LEVELS`, e.g. "Desk job · little or no exercise").
   *Feeds:* PAL multiplier (`PAL_FACTORS`) for the cold-start TDEE seed.
6. **Your goal** — direction (Lose / Maintain / Gain) + **goal weight** + comfortable weekly rate.
   - Rate guidance grounded in % of bodyweight per week (≈0.25–1.0% sustainable; >1% flagged as aggressive). Safety clamp via `clampGoalToSafety` so the implied target never drops below a safe floor; warn if a target would fall below BMR.
   - Goal weight + rate yields an estimated timeline shown back to the user.
7. **Dietary preference** — macro split pattern: Balanced / High-protein / Lower-carb / Custom, plus optional restriction tags (e.g., vegetarian, vegan) used later to bias food suggestions.
   *Feeds:* `computeMacroTargets` (protein g/kg, fat % of energy; protein anchored to lean mass when available).
8. **Reminders (optional)** — opt in to daily logging nudge, weigh-in reminder, and weekly check-in. Set preferred weigh-in cadence.
9. **Your starting plan** — the payoff screen: starting calories + macro split + estimated timeline, with a calm one-liner that these **adapt automatically** as real data comes in. CTA into the app.

### Under the hood

`seedTdee(profile, trendWeight, activityLevel, composition)` → `dailyTargetFromTdee(tdee, goal)` → `computeMacroTargets(target, weight, prefs)`. Persists `profiles`, `goals` (+ macro targets), optional `body_measurements`, and the initial `weight_entries` row, so the Today screen shows real numbers from minute one. Every weekly check-in thereafter pulls the estimate toward measured expenditure, so any seed error decays within a few weeks.

---

## 8. Design Language Direction (set in milestone, summarized here)

- **Foundation:** content-first, calm, high-contrast-where-it-counts. Light + dark from day one.
- **Color:** warm neutral base; one confident primary accent; a small, legible data-viz palette (distinct hues for calories/protein/carbs/fat and for trend vs. raw).
- **Type:** a clean modern sans for everything; numbers always tabular for alignment. Clear type ramp (display → body → label).
- **Shape & space:** comfortable radii, generous spacing, no boxes-within-boxes, no heavy glass. Hairlines used sparingly for structure, not as a motif.
- **Motion:** quiet and functional (≤150–200ms), no spring bounce or hero animations.
- **Components:** target rings/bars, macro breakdown, food-search rows, portion picker, trend chart (smooth line + raw scatter), weekly-check-in card, tab bar.

Tokens and components are produced with the `design-tokens` and `frontend-design` designer skills and reviewed with `design-review`.

---

## 9. Voice & Tone

Calm, plain-spoken, encouraging without being cheesy. We explain, we don't command, and we don't gamify.

| Use | Avoid |
|---|---|
| "Calories left" | "ENERGY FLUX RUNWAY" |
| "Weekly check-in" | "BAYESIAN AUDIT" |
| "Your targets adapted — here's why" | "Convergence in 4.2 days" |
| "Log weight" / "Add food" | "Mass / Fuel" |
| "You're on track" | "You crushed it! 🔥" |

---

## 10. Competitive Stance

- **vs MyFitnessPal:** faster logging, no ad clutter, smarter (adaptive) targets, modern design.
- **vs MacroFactor:** comparable intelligence, a snappier daily loop, room for a price/feature edge.
- **vs Lose It / Fitia / FatSecret:** the adaptive engine is the moat — they're static calculators; this recalibrates to reality.

---

## 11. First Milestone — "Clarity Foundation: Onboarding + Daily Loop"

Mobile-first (native Expo app). Web becomes a lightweight companion later. Build order:

1. **Design system** — tokens, type, color, core components, light + dark. The foundation every screen inherits.
2. **Onboarding** — the full scientific assessment (§7) in the new system.
3. **Today / Home** — redesigned end-to-end.
4. **Log (food) flow** — redesigned end-to-end.
5. **Tab-bar shell** — the new navigation in place.

**Outcome:** the first-run funnel plus the two highest-traffic screens look and feel like the target product, on a reusable foundation. Trends, Coach, barcode scanning, and other power features become fast iteration on top.

---

## 12. Out of Scope for Now (YAGNI)

Deferred until the core mobile experience is excellent: HealthKit sync, Live Activities / widgets, social features, full web-app parity, AI photo-calorie estimation, marketing site, barcode scanning (fast-follow after the daily loop ships).

---

## 13. Open Questions / Future

- Food database quality: Open Food Facts is the current source; a more complete/verified database (and barcode) is a near-term fast-follow, not in milestone 1.
- Web app: kept functional but not redesigned in milestone 1; revisit parity after mobile is solid.
- Pricing/monetization: out of scope for this brief.
