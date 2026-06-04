# Security & Web Completeness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical security issues, complete the missing Supabase RLS policies, and add the two most impactful missing web pages (log-weight + convergence accept) so the app is ready for live testing.

**Architecture:** All Supabase schema changes go through numbered migrations in `supabase/migrations/` and are applied with `supabase db push`. Web pages follow the existing `"use client"` pattern matching `apps/web/app/onboard/page.tsx` — session guard at the top, no extra dependencies.

**Tech Stack:** Next.js 15 App Router, Supabase JS client, `@dynamic-energy/data` repos, `@dynamic-energy/engine` types, Tailwind v4 CSS variables, gh CLI for push.

---

## Task 1: Pull latest code from GitHub

**Files:**
- Working dir: `/Volumes/Mac external disk/Calorie Dynamic Tracker`

- [ ] **Step 1: Pull latest main**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
git pull origin main
```

Expected: many commits downloaded, working tree clean.

- [ ] **Step 2: Verify supabase CLI is available**

```bash
supabase --version
```

Expected: version string printed (e.g. `1.x.x`). If missing, install via `brew install supabase/tap/supabase`.

---

## Task 2: Migration 0010 — meal_items RLS policies

`meal_items` has RLS enabled but zero policies, blocking all reads and writes. The ownership is indirect: a meal_item belongs to a user via `meal_id → meals.user_id`.

**Files:**
- Create: `supabase/migrations/0010_meal_items_rls.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/0010_meal_items_rls.sql
-- ============================================================================
-- Fix: meal_items had RLS enabled but no policies, blocking all access.
-- Ownership is via the parent meal row (meal_id → meals.user_id).
-- ============================================================================

create policy meal_items_select on public.meal_items
  for select to authenticated
  using (
    exists (
      select 1 from public.meals
      where id = meal_items.meal_id
        and user_id = (select auth.uid())
    )
  );

create policy meal_items_insert on public.meal_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.meals
      where id = meal_items.meal_id
        and user_id = (select auth.uid())
    )
  );

create policy meal_items_update on public.meal_items
  for update to authenticated
  using (
    exists (
      select 1 from public.meals
      where id = meal_items.meal_id
        and user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.meals
      where id = meal_items.meal_id
        and user_id = (select auth.uid())
    )
  );

create policy meal_items_delete on public.meal_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.meals
      where id = meal_items.meal_id
        and user_id = (select auth.uid())
    )
  );
```

- [ ] **Step 2: Apply to Supabase**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
supabase db push --project-ref xxqeifnvxfttqdhnllec
```

Expected: `0010_meal_items_rls` appears in the applied list, no errors.

---

## Task 3: Migration 0011 — security hardening

Fixes four Supabase advisor warnings: mutable search_path on `set_updated_at`, public-callable SECURITY DEFINER functions, `auth.uid()` re-evaluated per-row in RLS (performance), and missing FK indexes.

**Files:**
- Create: `supabase/migrations/0011_security_hardening.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/0011_security_hardening.sql
-- ============================================================================
-- Security hardening pass addressing Supabase advisor findings.
-- ============================================================================

-- 1. Fix set_updated_at: add immutable search_path to prevent search_path injection
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- 2. Revoke public execute on SECURITY DEFINER trigger functions.
--    handle_new_user is a trigger-only function; anon/authenticated should never
--    call it directly via /rest/v1/rpc.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- rls_auto_enable is an internal utility; also revoke.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from anon, authenticated';
  end if;
end
$$;

-- 3. Fix RLS auth() re-evaluation: replace auth.uid() with (select auth.uid())
--    across all user-owned tables so the value is computed once per query.

-- profiles
drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- goals
drop policy if exists goals_owner on public.goals;
create policy goals_owner on public.goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- weight_entries
drop policy if exists weight_entries_owner on public.weight_entries;
create policy weight_entries_owner on public.weight_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- activity_blocks
drop policy if exists activity_blocks_owner on public.activity_blocks;
create policy activity_blocks_owner on public.activity_blocks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- engine_state_weekly
drop policy if exists engine_state_weekly_owner on public.engine_state_weekly;
create policy engine_state_weekly_owner on public.engine_state_weekly
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- daily_targets
drop policy if exists daily_targets_owner on public.daily_targets;
create policy daily_targets_owner on public.daily_targets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- meals
drop policy if exists meals_owner on public.meals;
create policy meals_owner on public.meals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- foods (update/delete own-created rows)
drop policy if exists foods_update_own on public.foods;
create policy foods_update_own on public.foods
  for update to authenticated
  using (created_by = (select auth.uid()));

drop policy if exists foods_delete_own on public.foods;
create policy foods_delete_own on public.foods
  for delete to authenticated
  using (created_by = (select auth.uid()));

-- 4. Add missing FK covering indexes
create index if not exists foods_created_by_idx on public.foods (created_by);
create index if not exists meal_items_food_id_idx on public.meal_items (food_id);
```

- [ ] **Step 2: Apply to Supabase**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
supabase db push --project-ref xxqeifnvxfttqdhnllec
```

Expected: `0011_security_hardening` applied, no errors.

---

## Task 4: Fix Google OAuth redirect URL

`loginWithGoogle` in `apps/web/app/sign-in/page.tsx` sends `redirectTo: ${origin}/dashboard`. Supabase's PKCE flow appends `?code=...` to that URL. The dashboard page doesn't exchange the code, so the session is never established. The fix routes through the existing `/auth/callback` route which handles code exchange.

**Files:**
- Modify: `apps/web/app/sign-in/page.tsx` (line 29)

- [ ] **Step 1: Change the redirectTo line**

Find this block in `apps/web/app/sign-in/page.tsx`:

```ts
  const loginWithGoogle = async () => {
    setError(null);
    setBusy(true);
    // Explicitly construct redirect URL and ensure no trailing slashes or weirdness
    const origin = window.location.origin.replace(/\/$/, "");
    const redirectTo = `${origin}/dashboard`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
```

Replace the `redirectTo` line:

```ts
  const loginWithGoogle = async () => {
    setError(null);
    setBusy(true);
    const origin = window.location.origin.replace(/\/$/, "");
    const redirectTo = `${origin}/auth/callback?next=/dashboard`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
```

- [ ] **Step 2: Commit**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
git add apps/web/app/sign-in/page.tsx
git commit -m "fix(auth): route Google OAuth through /auth/callback for PKCE code exchange"
```

---

## Task 5: Add /log-weight page

Users have no way to log weight after the onboarding's first entry. This is the most critical missing web feature — without it the dashboard's weight chart and TDEE calculation stop updating after day 1.

The page follows the exact same pattern as `apps/web/app/log-meal/page.tsx`:
- Session guard at top
- Simple form: date (defaults today) + weight in kg
- Calls `repos.weight.log()`
- Redirects to `/dashboard` on success

**Files:**
- Create: `apps/web/app/log-weight/page.tsx`
- Modify: `apps/web/app/dashboard/page.tsx` (add sidebar link)
- Modify: `apps/web/middleware.ts` (protect the new route)

- [ ] **Step 1: Create the page**

```tsx
// apps/web/app/log-weight/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isConfigured, repos, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export default function LogWeightPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) router.replace("/sign-in");
  }, [session, router]);

  if (!isConfigured) {
    return (
      <main className="container section" style={{ textAlign: "center" }}>
        <span className="eyebrow">System · Offline</span>
        <h1 className="h2" style={{ marginTop: 16 }}>BACKEND NOT CONFIGURED</h1>
      </main>
    );
  }

  if (session === undefined || session === null) {
    return (
      <main className="container section" style={{ textAlign: "center" }}>
        <span className="meta" style={{ color: "var(--accent)" }}>Loading…</span>
      </main>
    );
  }

  return <WeightLogger userId={session.user.id} />;
}

function WeightLogger({ userId }: { userId: string }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [weightKg, setWeightKg] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(weightKg) > 0;

  const onSubmit = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await repos.weight.log({
        userId,
        date: date as Parameters<typeof repos.weight.log>[0]["date"],
        weightKg: Number(weightKg),
        note: note.trim() || undefined,
      });
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center p-6"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="w-full" style={{ maxWidth: 480 }}>
        <div className="glass-card glass-card-lg space-y-6">
          <div>
            <span className="eyebrow">Logger · Mass</span>
            <h1 className="h2 mt-2">Log Weight</h1>
            <p className="meta mt-1" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13, color: "var(--muted)" }}>
              Morning fasted weight gives the most consistent readings.
            </p>
          </div>

          <div>
            <label className="meta text-xs mb-2 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              className="input-minimal"
            />
          </div>

          <div>
            <label className="meta text-xs mb-2 block">Weight (kg)</label>
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              min={30}
              max={300}
              step={0.1}
              placeholder="e.g. 82.5"
              autoFocus
              className="input-minimal"
              style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}
            />
          </div>

          <div>
            <label className="meta text-xs mb-2 block">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. post-workout, high sodium day"
              className="input-minimal"
            />
          </div>

          {error && (
            <p style={{ color: "var(--error)", fontSize: 13 }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/dashboard"
              style={{
                flex: 1,
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                padding: "14px 20px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 999,
                cursor: "pointer",
                textAlign: "center",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Cancel
            </Link>
            <button
              onClick={onSubmit}
              disabled={busy || !valid}
              style={{
                flex: 2,
                background: "var(--accent)",
                color: "#ffffff",
                border: 0,
                padding: "14px 20px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 999,
                cursor: "pointer",
                opacity: busy || !valid ? 0.5 : 1,
              }}
            >
              {busy ? "Saving…" : "Log Weight →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Protect the route in middleware**

In `apps/web/middleware.ts`, add `"/log-weight"` to the `PROTECTED` array:

```ts
const PROTECTED = ["/dashboard", "/log-meal", "/import", "/onboard", "/log-weight"];
```

Also add to the `config.matcher`:

```ts
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/log-meal/:path*",
    "/import/:path*",
    "/onboard/:path*",
    "/log-weight/:path*",
    "/sign-in/:path*",
    "/sign-in",
  ],
};
```

- [ ] **Step 3: Add sidebar link in dashboard**

In `apps/web/app/dashboard/page.tsx`, find the sidebar nav links block (the `<div className="flex-1 flex flex-col gap-1 overflow-y-auto">` section) and add a "Log Weight" link after the "Log Nutrition" link:

```tsx
          <Link className="flex items-center gap-3 px-4 py-3 text-muted hover:bg-surface-container-high/50 rounded-xl transition-colors text-sm" href="/log-weight">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
            Log Weight
          </Link>
```

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
git add apps/web/app/log-weight/page.tsx apps/web/middleware.ts apps/web/app/dashboard/page.tsx
git commit -m "feat(web): add /log-weight page and sidebar link"
```

---

## Task 6: Add /convergence page (Bayesian accept flow)

Without this, `engine_state_weekly` stays empty forever — the Bayesian model never persists its weekly posterior. The page reuses the engine computation already in the dashboard, shows the current week's result, and writes to Supabase when the user clicks "Accept".

**Files:**
- Create: `apps/web/app/convergence/page.tsx`
- Modify: `apps/web/middleware.ts` (protect route)
- Modify: `apps/web/app/dashboard/page.tsx` (sidebar link + "Accept this week" CTA on the Bayesian status card)

- [ ] **Step 1: Create the convergence page**

```tsx
// apps/web/app/convergence/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ActivityLevel, type Composition, type IntakeEntry, type KcalDay,
  type WeeklyTdeeResult, type WeightEntry,
  computeWeeklyTdee, ewmaTrend, isoDate, latestTrendWeight,
  resolveComposition, seedTdee, unit, updateTdeePosterior, cm, years,
} from "@dynamic-energy/engine";
import type { BodyMeasurement } from "@dynamic-energy/data";
import { isConfigured, repos, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { round0, round1, signed, pct } from "@/lib/format";

export default function ConvergencePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) router.replace("/sign-in");
  }, [session, router]);

  if (!isConfigured) {
    return (
      <main className="container section" style={{ textAlign: "center" }}>
        <span className="eyebrow">System · Offline</span>
        <h1 className="h2" style={{ marginTop: 16 }}>BACKEND NOT CONFIGURED</h1>
      </main>
    );
  }

  if (session === undefined || session === null) {
    return (
      <main className="container section" style={{ textAlign: "center" }}>
        <span className="meta" style={{ color: "var(--accent)" }}>Loading…</span>
      </main>
    );
  }

  return <ConvergenceAudit userId={session.user.id} />;
}

type WeekEntry = {
  week: { start: string; end: string };
  result: WeeklyTdeeResult;
  posterior: KcalDay;
  alpha: number;
  prior: KcalDay;
};

function ConvergenceAudit({ userId }: { userId: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; history: WeekEntry[]; currentTdee: KcalDay }
    | { kind: "empty" }
    | { kind: "error"; message: string }
  >({ kind: "loading" });
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const since = (() => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - 90);
          return isoDate(d.toISOString().slice(0, 10));
        })();
        const [account, weights, intake, latestMeasurement] = await Promise.all([
          repos.profile.getAccount(userId),
          repos.weight.listSince(userId, since),
          repos.intake.listSince(userId, since),
          repos.bodyMeasurement.latest(userId),
        ]);
        if (!account || weights.length === 0) {
          setState({ kind: "empty" });
          return;
        }

        const profile = {
          sex: account.profile.sex,
          age: years(account.profile.age),
          heightCm: cm(account.profile.heightCm),
        };

        const trendWeight = latestTrendWeight(weights) ?? weights[weights.length - 1]!.weight;
        const m: BodyMeasurement | null = latestMeasurement;
        const composition: Composition | null = m
          ? resolveComposition({
              sex: profile.sex,
              heightCm: profile.heightCm,
              weightKg: trendWeight,
              neckCm: m.neckCm != null ? cm(m.neckCm) : undefined,
              waistCm: m.waistCm != null ? cm(m.waistCm) : undefined,
              hipCm: m.hipCm != null ? cm(m.hipCm) : undefined,
              directBodyFatPct: m.bodyFatPct != null ? unit(m.bodyFatPct) : undefined,
            })
          : null;

        const seedPrior = seedTdee(profile, weights[weights.length - 1]!.weight, account.activityLevel, composition);
        const startDate = weights[0]!.date;
        const endDate = weights[weights.length - 1]!.date;
        const windows = mondayWindows(startDate, endDate);

        const history: WeekEntry[] = [];
        let prior = seedPrior;
        for (const w of windows) {
          const result = computeWeeklyTdee(isoDate(w.start), isoDate(w.end), intake, weights);
          const u = updateTdeePosterior(prior, result);
          history.push({ week: w, result, posterior: u.posterior, alpha: u.alpha, prior });
          prior = u.posterior;
        }

        setState({
          kind: "ready",
          history,
          currentTdee: history[history.length - 1]?.posterior ?? seedPrior,
        });
      } catch (e) {
        setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, [userId]);

  const acceptWeek = async (entry: WeekEntry) => {
    setAccepting(entry.week.start);
    try {
      await repos.engineState.upsertWeek({
        userId,
        weekStart: isoDate(entry.week.start),
        tdeePrior: entry.prior,
        tdeeWeek: entry.result.tdeeWeek,
        tdeePosterior: entry.posterior,
        alpha: entry.alpha,
        completeness: entry.result.completeness,
        avgIntake: entry.result.avgIntake,
        deltaWeightKg: entry.result.deltaWeightKg,
        accepted: true,
      });
    } finally {
      setAccepting(null);
    }
  };

  const acceptAll = async () => {
    if (state.kind !== "ready") return;
    for (const entry of state.history) {
      await acceptWeek(entry);
    }
    router.push("/dashboard");
  };

  if (state.kind === "loading") {
    return (
      <main className="container section" style={{ textAlign: "center" }}>
        <span className="meta" style={{ color: "var(--accent)" }}>Computing convergence…</span>
      </main>
    );
  }
  if (state.kind === "error") {
    return (
      <main className="container section">
        <span className="eyebrow">System · Fault</span>
        <h1 className="h2" style={{ marginTop: 16 }}>SYNC FAILURE</h1>
        <p style={{ color: "var(--muted)", marginTop: 24 }}>{state.message}</p>
      </main>
    );
  }
  if (state.kind === "empty") {
    return (
      <main className="container section" style={{ maxWidth: 600 }}>
        <span className="eyebrow">Engine · Cold</span>
        <h1 className="h2" style={{ marginTop: 16 }}>NO DATA YET</h1>
        <p style={{ color: "var(--muted)", marginTop: 24 }}>
          Log weight and meals for at least one week before convergence is available.
        </p>
        <Link href="/dashboard" style={{ color: "var(--accent)", marginTop: 24, display: "block" }}>
          ← Back to Dashboard
        </Link>
      </main>
    );
  }

  const { history, currentTdee } = state;
  const latestWeek = history[history.length - 1];

  return (
    <div className="min-h-screen bg-bg text-fg" style={{ fontFamily: "var(--font-body)" }}>
      <div className="container section" style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 32 }}>
          <span className="eyebrow">Bayesian Engine · Weekly Audit</span>
          <h1 className="h2 mt-2">Convergence</h1>
          <p className="meta mt-1" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13, color: "var(--muted)" }}>
            Accept weeks to persist the Bayesian model. Accepted weeks seed the prior for future estimates.
          </p>
        </div>

        {/* Current TDEE summary */}
        <div className="glass-card glass-card-lg" style={{ marginBottom: 24 }}>
          <span className="meta">Current Posterior</span>
          <h2 className="h1 text-accent mt-2 font-bold" style={{ fontSize: 44 }}>
            {round0(currentTdee)} <span className="text-sm font-normal text-muted">kcal/day</span>
          </h2>
          {latestWeek && (
            <p className="meta mt-2" style={{ textTransform: "none", letterSpacing: 0, fontSize: 12, color: "var(--muted)" }}>
              Latest week: {latestWeek.week.start} → {latestWeek.week.end} · α = {latestWeek.alpha === 0 ? "skipped" : latestWeek.alpha.toFixed(2)}
            </p>
          )}
          <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
            <button
              onClick={acceptAll}
              disabled={accepting !== null}
              style={{
                background: "var(--accent)", color: "#fff", border: 0,
                padding: "14px 24px", fontSize: 14, fontWeight: 600,
                borderRadius: 999, cursor: "pointer",
                opacity: accepting !== null ? 0.5 : 1,
              }}
            >
              {accepting !== null ? "Saving…" : `Accept All ${history.length} Weeks →`}
            </button>
            <Link
              href="/dashboard"
              style={{
                background: "transparent", border: "1px solid var(--border)",
                color: "var(--fg)", padding: "14px 24px", fontSize: 14, fontWeight: 600,
                borderRadius: 999, cursor: "pointer", textDecoration: "none", display: "inline-block",
              }}
            >
              Back
            </Link>
          </div>
        </div>

        {/* Weekly history table */}
        <section>
          <span className="meta" style={{ display: "block", marginBottom: 12 }}>Week-by-Week Audit</span>
          <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 0.8fr 1fr",
              gap: "1px",
              background: "rgba(193,198,215,0.4)",
            }}>
              {["Week", "Avg Intake", "Δ Weight", "Inferred TDEE", "Posterior", "α", "Action"].map((h) => (
                <div key={h} className="tg-cell" style={{ background: "var(--surface)" }}>
                  <span className="meta">{h}</span>
                </div>
              ))}
              {history.slice().reverse().map((entry) => (
                <ConvergenceRow
                  key={entry.week.start}
                  entry={entry}
                  onAccept={() => acceptWeek(entry)}
                  accepting={accepting === entry.week.start}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const ConvergenceRow = ({
  entry,
  onAccept,
  accepting,
}: {
  entry: WeekEntry;
  onAccept: () => void;
  accepting: boolean;
}) => {
  const dropped = entry.alpha === 0;
  return (
    <>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span className="num" style={{ fontSize: 12 }}>{entry.week.start}</span>
        <span className="meta">{pct(entry.result.completeness)}</span>
      </div>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span className="num" style={{ fontSize: 15 }}>{round0(entry.result.avgIntake)}</span>
      </div>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span className="num" style={{ fontSize: 15, color: entry.result.deltaWeightKg < 0 ? "var(--accent)" : "var(--fg)" }}>
          {signed(entry.result.deltaWeightKg, 2)} kg
        </span>
      </div>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span className="num" style={{ fontSize: 15 }}>{round0(entry.result.tdeeWeek)}</span>
      </div>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span className="num" style={{ fontSize: 15, fontWeight: 700, color: dropped ? "var(--muted)" : "var(--accent)" }}>
          {round0(entry.posterior)}
        </span>
        <span className="meta">{signed(entry.posterior - entry.prior)}</span>
      </div>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span className="num" style={{ fontSize: 15, color: dropped ? "var(--muted)" : "var(--fg)" }}>
          {dropped ? "—" : entry.alpha.toFixed(2)}
        </span>
      </div>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <button
          onClick={onAccept}
          disabled={accepting || dropped}
          style={{
            background: dropped ? "transparent" : "var(--accent)",
            color: dropped ? "var(--muted)" : "#fff",
            border: dropped ? "1px solid var(--border)" : 0,
            padding: "6px 12px", fontSize: 11, fontWeight: 600,
            borderRadius: 6, cursor: dropped ? "not-allowed" : "pointer",
            opacity: accepting ? 0.5 : 1,
          }}
        >
          {accepting ? "…" : dropped ? "Skip" : "Accept"}
        </button>
      </div>
    </>
  );
};

const mondayWindows = (startIso: string, endIso: string) => {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const day = start.getUTCDay();
  const delta = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  start.setUTCDate(start.getUTCDate() + delta);
  const out: { start: string; end: string }[] = [];
  while (true) {
    const wkEnd = new Date(start);
    wkEnd.setUTCDate(wkEnd.getUTCDate() + 6);
    if (wkEnd > end) break;
    out.push({ start: start.toISOString().slice(0, 10), end: wkEnd.toISOString().slice(0, 10) });
    start.setUTCDate(start.getUTCDate() + 7);
  }
  return out;
};
```

- [ ] **Step 2: Protect the route in middleware**

In `apps/web/middleware.ts`, add `"/convergence"` to the `PROTECTED` array and `config.matcher`:

```ts
const PROTECTED = ["/dashboard", "/log-meal", "/import", "/onboard", "/log-weight", "/convergence"];
```

```ts
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/log-meal/:path*",
    "/import/:path*",
    "/onboard/:path*",
    "/log-weight/:path*",
    "/convergence/:path*",
    "/sign-in/:path*",
    "/sign-in",
  ],
};
```

- [ ] **Step 3: Add sidebar link in dashboard**

In `apps/web/app/dashboard/page.tsx`, add a "Convergence" link in the sidebar nav after the "Log Weight" link:

```tsx
          <Link className="flex items-center gap-3 px-4 py-3 text-muted hover:bg-surface-container-high/50 rounded-xl transition-colors text-sm" href="/convergence">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Convergence
          </Link>
```

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
git add apps/web/app/convergence/page.tsx apps/web/middleware.ts apps/web/app/dashboard/page.tsx
git commit -m "feat(web): add /convergence page for Bayesian weekly accept flow"
```

---

## Task 7: Apply migrations and push everything to GitHub

- [ ] **Step 1: Apply both new migrations to Supabase**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
supabase db push --project-ref xxqeifnvxfttqdhnllec
```

Expected output: `0010_meal_items_rls` and `0011_security_hardening` appear as applied.

- [ ] **Step 2: Commit the migration files**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
git add supabase/migrations/0010_meal_items_rls.sql supabase/migrations/0011_security_hardening.sql
git commit -m "fix(db): meal_items RLS policies + security hardening (revoke EXECUTE, fix search_path, RLS initplan, FK indexes)"
```

- [ ] **Step 3: Push all commits to GitHub**

```bash
cd "/Volumes/Mac external disk/Calorie Dynamic Tracker"
git push origin main
```

Expected: Vercel auto-deploys from the push. Wait ~2 minutes for the deployment to go READY.

---

## Task 8: Manual Vercel + Supabase config (do in browser)

These cannot be scripted — do them in the dashboard.

### Vercel env vars

Go to [Vercel → dynamic-energy-tracker-web → Settings → Environment Variables](https://vercel.com/sessmaars-projects/dynamic-energy-tracker-web/settings/environment-variables) and add for **Production + Preview + Development**:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxqeifnvxfttqdhnllec.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(from Supabase → Settings → API → anon public key)* |

Then trigger a redeploy so the new vars take effect.

### Supabase Auth URL config

Go to [Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/xxqeifnvxfttqdhnllec/auth/url-configuration):

- **Site URL:** `https://dynamic-energy-tracker-web.vercel.app`
- **Additional Redirect URLs** (add each):
  - `http://localhost:3000/**`
  - `https://dynamic-energy-tracker-web.vercel.app/**`
  - `https://*-sessmaars-projects.vercel.app/**`

### Google OAuth

Go to Supabase → Authentication → Providers → Google, enable it, add Client ID and Secret from Google Cloud Console.

### Leaked password protection

Go to Supabase → Authentication → Settings → enable "Leaked password protection (HaveIBeenPwned)".
