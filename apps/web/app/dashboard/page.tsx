"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type IntakeEntry, type KcalDay, type WeeklyTdeeResult, type WeightEntry,
  computeWeeklyTdee, dailyTargetFromTdee, ewmaTrend, isoDate, kcalDay, kg,
  mifflinStJeor, updateTdeePosterior, years, cm,
} from "@dynamic-energy/engine";
import { LineChart } from "@/components/LineChart";
import { Runway } from "@/components/Runway";
import { pct, round0, round1, signed } from "@/lib/format";
import { isConfigured, repos, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

/**
 * Live per-user dashboard. Mirrors the structure of the demo console at
 * `/` but pulls real data from Supabase via @dynamic-energy/data. The
 * engine is identical — proves the same pure functions render correct
 * output across two data sources (seed vs. live).
 *
 * Lifecycle: client-only because we need the authenticated supabase
 * session. The marketing console at `/` stays SSR.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) return <ConfigErrorState />;
  if (session === undefined) return <LoadingState label="Restoring session…" />;
  if (!session) {
    router.replace("/sign-in");
    return null;
  }
  return <LiveDashboard userId={session.user.id} email={session.user.email ?? ""} />;
}

// ------------------------------------------------------------------------

const LiveDashboard = ({ userId, email }: { userId: string; email: string }) => {
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; weights: WeightEntry[]; intake: IntakeEntry[]; profile: { heightCm: number; age: number; sex: "male" | "female" } | null; goalKgPerWeek: number }
    | { kind: "empty" }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    void (async () => {
      try {
        const since = (() => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - 90);
          return isoDate(d.toISOString().slice(0, 10));
        })();
        const [profile, goal, weights, intake] = await Promise.all([
          repos.profile.get(userId),
          repos.goal.getActive(userId),
          repos.weight.listSince(userId, since),
          repos.intake.listSince(userId, since),
        ]);
        if (!profile || weights.length === 0) {
          setState({ kind: "empty" });
          return;
        }
        setState({
          kind: "ready",
          weights,
          intake,
          profile: { heightCm: profile.heightCm, age: profile.age, sex: profile.sex },
          goalKgPerWeek: goal?.kgPerWeek ?? 0,
        });
      } catch (e) {
        setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, [userId]);

  if (state.kind === "loading") return <LoadingState label="Pulling telemetry…" />;
  if (state.kind === "error") return <ErrorState message={state.message} />;
  if (state.kind === "empty") return <EmptyState email={email} onSignOut={() => signOutAndGo(router)} />;

  // --- Engine pass over live data ---------------------------------------
  const profile = {
    sex: state.profile!.sex,
    age: years(state.profile!.age),
    heightCm: cm(state.profile!.heightCm),
  };
  const startDate = state.weights[0]!.date;
  const endDate = state.weights[state.weights.length - 1]!.date;

  const seedTdee = kcalDay(mifflinStJeor(profile, state.weights[state.weights.length - 1]!.weight) * 1.4);
  const windows = mondayWindows(startDate, endDate);
  const history: Array<{
    week: { start: string; end: string };
    result: WeeklyTdeeResult;
    posterior: KcalDay;
    alpha: number;
  }> = [];
  let prior = seedTdee;
  for (const w of windows) {
    const result = computeWeeklyTdee(isoDate(w.start), isoDate(w.end), state.intake, state.weights);
    const u = updateTdeePosterior(prior, result);
    history.push({ week: w, result, posterior: u.posterior, alpha: u.alpha });
    prior = u.posterior;
  }
  const currentTdee = history[history.length - 1]?.posterior ?? seedTdee;
  const target = dailyTargetFromTdee(currentTdee, { kgPerWeek: state.goalKgPerWeek });

  const trend = ewmaTrend(state.weights);
  const todayIntake = state.intake[state.intake.length - 1]?.calories ?? 0;
  const fillFraction = target ? todayIntake / target : 0;

  const tdeeSeries = history.map((h, i) => ({
    x: i / Math.max(history.length - 1, 1),
    y: h.posterior,
  }));
  const weightScatter = state.weights.map((w, i) => ({
    x: i / Math.max(state.weights.length - 1, 1), y: w.weight,
  }));
  const weightTrend = trend.map((t, i) => ({
    x: i / Math.max(trend.length - 1, 1), y: t.trend,
  }));

  return (
    <>
      <header className="topnav">
        <div className="container topnav-inner">
          <span className="topnav-logo">DET<span style={{ color: "var(--accent)" }}>·</span>CONSOLE</span>
          <nav style={{ alignItems: "center", gap: "var(--gap-md)" }}>
            <Link href="/">Demo</Link>
            <Link href="/dashboard" className="active">Live</Link>
            <Link href="/log-meal">Log Meal</Link>
            <Link href="/import">Import</Link>
            <span className="meta">{email}</span>
            <button onClick={() => signOutAndGo(router)} className="meta"
              style={{ background: "transparent", border: 0, color: "var(--muted)", cursor: "pointer" }}>
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      <main className="container section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--gap-lg)" }}>
          <div>
            <span className="eyebrow">System · Live Telemetry</span>
            <h1 className="h1" style={{ marginTop: 16 }}>DASHBOARD</h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="meta">Window · {startDate} → {endDate}</span>
            <div className="num bignum" style={{ color: "var(--accent)", marginTop: 8 }}>{round0(currentTdee)}</div>
            <span className="meta">Inferred TDEE · KCAL/D</span>
          </div>
        </div>

        <div className="card card-lg" style={{ marginBottom: "var(--gap-lg)" }}>
          <div className="row between" style={{ marginBottom: "var(--gap-md)" }}>
            <span className="meta">Today · Energy Flux Runway</span>
            <span className="num" style={{ fontSize: 13, color: todayIntake > target ? "var(--fg)" : "var(--accent)" }}>
              {signed(todayIntake - target)} <span className="meta">NET</span>
            </span>
          </div>
          <Runway fillFraction={fillFraction} targetFraction={1} />
          <div className="row between" style={{ marginTop: "var(--gap-md)" }}>
            <div><span className="meta">Logged</span><div className="bignum">{round0(todayIntake)}</div></div>
            <div style={{ textAlign: "right" }}>
              <span className="meta">Target</span>
              <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{round0(target)}</div>
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <section className="card card-lg" style={{ marginBottom: "var(--gap-lg)" }}>
            <div className="row between" style={{ marginBottom: "var(--gap-md)" }}>
              <div>
                <span className="meta">Posterior Trace · {history.length}-Week Convergence</span>
                <h3 className="h3" style={{ marginTop: 4 }}>TDEE Estimate</h3>
              </div>
            </div>
            <LineChart
              series={tdeeSeries}
              yMin={Math.min(...tdeeSeries.map((p) => p.y)) - 50}
              yMax={Math.max(...tdeeSeries.map((p) => p.y)) + 50}
              xStartLabel={startDate}
              xEndLabel={endDate}
            />
          </section>
        )}

        <section className="card card-lg">
          <div className="row between" style={{ marginBottom: "var(--gap-md)" }}>
            <div>
              <span className="meta">Mass Telemetry · Raw vs. EWMA Trend</span>
              <h3 className="h3" style={{ marginTop: 4 }}>Body Mass</h3>
            </div>
            <span className="meta">Δ Trend · <span className="num" style={{ color: "var(--accent)" }}>
              {signed(weightTrend[weightTrend.length - 1]!.y - weightTrend[0]!.y, 1)} kg
            </span></span>
          </div>
          <LineChart
            series={weightTrend}
            scatter={weightScatter}
            yMin={Math.min(...weightScatter.map((p) => p.y)) - 0.5}
            yMax={Math.max(...weightScatter.map((p) => p.y)) + 0.5}
            yTopLabel={`${round1(Math.max(...weightScatter.map((p) => p.y)))} kg`}
            yBottomLabel={`${round1(Math.min(...weightScatter.map((p) => p.y)))} kg`}
            xStartLabel={startDate}
            xEndLabel={endDate}
          />
        </section>
      </main>
    </>
  );
};

// --- helpers --------------------------------------------------------------

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

const signOutAndGo = async (router: ReturnType<typeof useRouter>) => {
  await supabase.auth.signOut();
  router.replace("/sign-in");
};

const LoadingState = ({ label }: { label: string }) => (
  <main className="container section" style={{ textAlign: "center" }}>
    <span className="meta" style={{ color: "var(--accent)" }}>{label}</span>
  </main>
);

const ErrorState = ({ message }: { message: string }) => (
  <main className="container section">
    <span className="eyebrow">System · Fault</span>
    <h1 className="h2" style={{ marginTop: 16 }}>TELEMETRY FAULT</h1>
    <p style={{ color: "var(--muted)", marginTop: 24 }}>{message}</p>
  </main>
);

const EmptyState = ({ email, onSignOut }: { email: string; onSignOut: () => void }) => (
  <main className="container section" style={{ maxWidth: 720 }}>
    <span className="eyebrow">System · Cold Start</span>
    <h1 className="h2" style={{ marginTop: 16, marginBottom: 24 }}>NO BASELINE</h1>
    <p style={{ color: "var(--muted)", maxWidth: 540, marginBottom: 40 }}>
      Signed in as <span className="num">{email}</span>, but the engine has no
      profile or weight readings to anchor on yet. Three ways to populate it:
    </p>

    <div className="tg tg-3" style={{ marginBottom: 32 }}>
      <div className="tg-cell" style={{ gap: 12 }}>
        <span className="eyebrow">Path · One</span>
        <span className="h3">Mobile Onboard</span>
        <p className="meta" style={{ color: "var(--muted)", textTransform: "none", letterSpacing: 0 }}>
          Install Expo Go, sign in with the same email, complete the
          CALIBRATE screen. Recommended for new users.
        </p>
      </div>
      <div className="tg-cell" style={{ gap: 12 }}>
        <span className="eyebrow">Path · Two</span>
        <span className="h3">Import History</span>
        <p className="meta" style={{ color: "var(--muted)", textTransform: "none", letterSpacing: 0 }}>
          MyFitnessPal export → <Link href="/import" style={{ color: "var(--accent)" }}>/import</Link>.
          Drops months of weights + meals into the engine instantly.
        </p>
      </div>
      <div className="tg-cell" style={{ gap: 12 }}>
        <span className="eyebrow">Path · Three</span>
        <span className="h3">Log Manually</span>
        <p className="meta" style={{ color: "var(--muted)", textTransform: "none", letterSpacing: 0 }}>
          Use <Link href="/log-meal" style={{ color: "var(--accent)" }}>/log-meal</Link> on the web — note that you
          still need a profile from the mobile onboarding for BMR to compute.
        </p>
      </div>
    </div>

    <button onClick={onSignOut} className="meta" style={{
      background: "transparent", border: "0.5px solid var(--border)",
      padding: "12px 24px", color: "var(--fg)", cursor: "pointer", borderRadius: 4,
    }}>Sign Out</button>
  </main>
);

const ConfigErrorState = () => (
  <main className="container section">
    <span className="eyebrow">System · Offline</span>
    <h1 className="h2" style={{ marginTop: 16 }}>BACKEND NOT CONFIGURED</h1>
    <p style={{ color: "var(--muted)", marginTop: 24 }}>
      Supabase env vars missing. See <code className="num">supabase/README.md</code>.
    </p>
  </main>
);
