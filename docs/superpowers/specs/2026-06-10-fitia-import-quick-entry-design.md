# Fitia Import + Quick Macro Entry + Full-History Engine — Design

**Date:** 2026-06-10
**Status:** Approved

## Goal

Three changes to the personal PWA, driven by real usage:
1. Import historical data from a **Fitia Excel export** so the TDEE engine recalibrates from real history.
2. Make **quick macro entry** (type 4 numbers) the default logging mode instead of food search.
3. Make the engine walk the **entire logged history** instead of the last 90 days.

## 1. Fitia importer

**Verified export format** (from a real export, `exportedData.xlsx`): a multi-sheet `.xlsx` with English sheet/column names regardless of app locale:

- `Nutrition` — daily totals: `Date` (string `YYYY-MM-DD`), `Energy (kcal)`, `Proteins (g)`, `Carbs (g)`, `Fats (g)`, plus micros we ignore. One zero-kcal row observed for unlogged days → skip rows with `kcal <= 0`.
- `Body` — `Date`, `Weight (kg)`, `Body Fat (%)`, circumferences. **Unsorted**; zeros mean "not measured" → import only `Weight (kg) > 0`; sort by date.
- `Diary` — per-meal detail. Sums exactly to Nutrition's daily totals (verified) → ignored; daily totals are all the engine needs.
- `Fasting` — ignored.

**Implementation:**
- Parse in-browser with SheetJS CE (pinned tarball from `cdn.sheetjs.com`, avoids the stale/vulnerable npm registry version). The file never leaves the device — consistent with the no-backend architecture.
- Pure parser module `apps/web/lib/importers/fitia.ts`: `ArrayBuffer → { days, weights, skipped }`. Dates normalized defensively (string, JS Date, or Excel serial). Unit-tested against a synthetic in-memory workbook with the same sheets/headers — the user's real export (personal data) is never committed to the public repo.
- Merge-commit module: writes each day as one `quick_add` meal ("Fitia import") and each weigh-in as a weight entry, **skipping dates that already exist** in the store. Returns added/skipped counts.
- `/import` page gains a Fitia section (file picker → preview card with counts + date range → confirm). The parser is dynamically imported so SheetJS only loads on that route. MFP CSV import stays.

**Known limitation surfaced to the user:** the sample export covers ~1 month. The importer handles any range; a longer Fitia export (if available) imports identically.

## 2. Quick macro entry

`/log-meal` becomes two modes with a segmented toggle, **Quick** as default:
- Quick: `Calories` (required), `Protein / Carbs / Fat` (optional), optional name, meal-type selector (defaults to snack). One tap to log → `/today`.
- Search: the existing Open Food Facts + recents + custom-food flow, unchanged, behind the second tab.

## 3. Full-history engine walk

`/today`, `/dashboard`, `/convergence` currently compute over `now − 90 days`. All three change to walk from the **earliest weight entry** (`since = "1970-01-01"`). A year of data ≈ 52 weekly Bayesian updates — trivial client-side. Charts render the full range.

## Out of scope

Fitia Diary per-meal import, Fasting data, body-fat/circumference import (only one nonzero row in real data), automatic re-import/sync.

## Testing

- Parser + merge logic: vitest, TDD, synthetic workbook fixture built in-memory with SheetJS.
- Pages: typecheck + production build + manual smoke (import real file locally, verify counts and Today/Trends reflect history).
