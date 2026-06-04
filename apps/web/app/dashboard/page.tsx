"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ActivityLevel, type Composition, type IntakeEntry, type KcalDay,
  type WeeklyTdeeResult, type WeightEntry,
  computeWeeklyTdee, dailyTargetFromTdee, ewmaTrend, isoDate, latestTrendWeight,
  resolveComposition, seedTdee, unit, updateTdeePosterior, cm, years,
} from "@dynamic-energy/engine";
import type { BodyMeasurement } from "@dynamic-energy/data";
import { LineChart } from "@/components/LineChart";
import { Runway } from "@/components/Runway";
import { pct, round0, round1, signed } from "@/lib/format";
import { isConfigured, repos, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

/**
 * Live per-user dashboard console. Redesigned to reflect the
 * "Dense Matrix Command Center" layout, featuring side navigation,
 * telemetry grids, and light-theme glassmorphism.
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

  useEffect(() => {
    if (session === null) {
      router.replace("/sign-in");
    }
  }, [session, router]);

  if (!isConfigured) return <ConfigErrorState />;
  if (session === undefined || session === null) return <LoadingState label="Restoring session…" />;
  
  return <LiveDashboard userId={session.user.id} email={session.user.email ?? ""} />;
}

// ------------------------------------------------------------------------

const LiveDashboard = ({ userId, email }: { userId: string; email: string }) => {
  const router = useRouter();
  const userName = email.split("@")[0] || "User";
  const displayUserName = userName.charAt(0).toUpperCase() + userName.slice(1);

  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; weights: WeightEntry[]; intake: IntakeEntry[]; profile: { heightCm: number; age: number; sex: "male" | "female" } | null; timezone: string; activityLevel: ActivityLevel; latestMeasurement: BodyMeasurement | null; goalKgPerWeek: number }
    | { kind: "empty" }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  // Interactive local states for the dashboard cards
  const [waterLiters, setWaterLiters] = useState(2.1);
  const [stepsGoalPct, setStepsGoalPct] = useState(82.4);

  useEffect(() => {
    void (async () => {
      try {
        const since = (() => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - 90);
          return isoDate(d.toISOString().slice(0, 10));
        })();
        const [account, goal, weights, intake, latestMeasurement] = await Promise.all([
          repos.profile.getAccount(userId),
          repos.goal.getActive(userId),
          repos.weight.listSince(userId, since),
          repos.intake.listSince(userId, since),
          repos.bodyMeasurement.latest(userId),
        ]);
        if (!account || weights.length === 0) {
          setState({ kind: "empty" });
          return;
        }
        setState({
          kind: "ready",
          weights,
          intake,
          profile: {
            heightCm: account.profile.heightCm,
            age: account.profile.age,
            sex: account.profile.sex,
          },
          timezone: account.timezone,
          activityLevel: account.activityLevel,
          latestMeasurement,
          goalKgPerWeek: goal?.kgPerWeek ?? 0,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
        setState({ kind: "error", message: msg });
      }
    })();
  }, [userId]);

  if (state.kind === "loading") return <LoadingState label="Syncing your data…" />;
  if (state.kind === "error") return <ErrorState message={state.message} />;
  if (state.kind === "empty") return <EmptyState email={email} onSignOut={() => signOutAndGo(router)} />;

  // --- Engine Calculations -----------------------------------------------
  const profile = {
    sex: state.profile!.sex,
    age: years(state.profile!.age),
    heightCm: cm(state.profile!.heightCm),
  };
  const startDate = state.weights[0]!.date;
  const endDate = state.weights[state.weights.length - 1]!.date;

  const trendWeight = latestTrendWeight(state.weights) ?? state.weights[state.weights.length - 1]!.weight;
  const m = state.latestMeasurement;
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

  const seedPrior = seedTdee(profile, state.weights[state.weights.length - 1]!.weight, state.activityLevel, composition);
  const windows = mondayWindows(startDate, endDate);
  const history: Array<{
    week: { start: string; end: string };
    result: WeeklyTdeeResult;
    posterior: KcalDay;
    alpha: number;
    prior: KcalDay;
  }> = [];

  let prior = seedPrior;
  for (const w of windows) {
    const result = computeWeeklyTdee(isoDate(w.start), isoDate(w.end), state.intake, state.weights);
    const u = updateTdeePosterior(prior, result);
    history.push({ week: w, result, posterior: u.posterior, alpha: u.alpha, prior });
    prior = u.posterior;
  }
  const currentTdee = history[history.length - 1]?.posterior ?? seedPrior;
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

  const convergence = getConvergenceStatus(state.intake, state.weights, state.timezone);

  return (
    <div className="layout-root">
      {/* Desktop Sidebar Navigation */}
      <nav className="sidebar">
        <div className="mb-10 px-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-fg">Dense Matrix</span>
        </div>

        <div className="mb-8 px-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/5 border border-border/30 flex items-center justify-center font-bold text-accent">
            {displayUserName[0]}
          </div>
          <div>
            <h3 className="font-body text-sm font-semibold text-fg">{displayUserName}</h3>
            <p className="font-mono text-[10px] text-muted uppercase">Console Member</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
          <Link className="flex items-center gap-3 px-4 py-3 bg-accent/10 text-accent rounded-xl font-bold transition-all text-sm" href="/dashboard">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
            </svg>
            Overview
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 text-muted hover:bg-surface-container-high/50 rounded-xl transition-colors text-sm" href="/log-meal">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Log Nutrition
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 text-muted hover:bg-surface-container-high/50 rounded-xl transition-colors text-sm" href="/log-weight">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
            Log Weight
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 text-muted hover:bg-surface-container-high/50 rounded-xl transition-colors text-sm" href="/convergence">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Convergence
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 text-muted hover:bg-surface-container-high/50 rounded-xl transition-colors text-sm" href="/import">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Data
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 text-muted hover:bg-surface-container-high/50 rounded-xl transition-colors text-sm" href="/demo">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Engine Sandbox
          </Link>
        </div>

        <div className="mt-auto pt-4 border-t border-border/20 flex flex-col gap-1">
          <button onClick={() => signOutAndGo(router)} className="flex items-center gap-3 px-4 py-3 text-muted hover:bg-surface-container-high/50 rounded-xl transition-colors text-sm w-full text-left bg-transparent border-0 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="content-area p-6 md:p-10 w-full overflow-y-auto">
        {/* Mobile Header Nav */}
        <header className="md:hidden flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-fg">Dense Matrix</h1>
            <p className="font-mono text-[10px] text-muted uppercase">Console Dashboard</p>
          </div>
          <button onClick={() => signOutAndGo(router)} className="text-muted hover:text-fg text-xs font-semibold bg-transparent border-0 cursor-pointer">
            Sign Out
          </button>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex justify-between items-center mb-8">
          <div>
            <h1 className="h2 text-fg">Overview</h1>
            <p className="font-body text-sm text-muted mt-1">Real-time Bayesian metabolic inference & energy runway</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-border/30 shadow-sm text-xs font-semibold font-mono text-muted">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </header>

        {/* Telemetry Bento Grid */}
        <div className="tg mb-6">
          {/* Water Intake (Interactive Mock) */}
          <div className="glass-card tg-cell col-span-1 md:col-span-4 lg:col-span-3 min-h-[160px] relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-body text-sm font-semibold text-muted">Water</h3>
              <button 
                onClick={() => setWaterLiters(prev => Math.round((prev + 0.25) * 100) / 100)} 
                className="w-7 h-7 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary hover:scale-105 transition-transform border-0 cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="flex items-baseline gap-1.5 z-10 relative">
              <span className="font-display text-3xl font-bold text-fg">{waterLiters}</span>
              <span className="font-body text-xs text-muted">Liters</span>
            </div>
            
            {/* Water Wave Indicator */}
            <div className="absolute bottom-0 left-0 w-full h-16 pointer-events-none opacity-20">
              <svg className="w-full h-full text-secondary-container" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M0,60 C30,50 70,70 100,60 L100,100 L0,100 Z" fill="currentColor" />
              </svg>
            </div>
            <p className="text-[10px] font-mono text-muted uppercase mt-4 z-10 relative">
              {pct(waterLiters / 3.0)} of 3.0L Target
            </p>
          </div>

          {/* Calories Intake */}
          <div className="glass-card tg-cell col-span-1 md:col-span-4 lg:col-span-3 min-h-[160px]">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-body text-sm font-semibold text-muted">Calories</h3>
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-bold text-fg">{round0(todayIntake)}</span>
              <span className="font-body text-xs text-muted">kcal</span>
            </div>
            <p className="text-[10px] font-mono text-muted uppercase mt-4">
              Daily Budget: {round0(target)} kcal
            </p>
          </div>

          {/* Steps Goal (Interactive Mock) */}
          <div className="glass-card tg-cell col-span-1 md:col-span-4 lg:col-span-3 min-h-[160px] items-center justify-center text-center">
            <div className="w-full flex justify-between items-center mb-2">
              <h3 className="font-body text-sm font-semibold text-muted">Steps</h3>
              <button 
                onClick={() => setStepsGoalPct(prev => Math.min(100, Math.round(prev + 5.5)))} 
                className="text-accent text-xs font-semibold bg-transparent border-0 cursor-pointer"
              >
                Step
              </button>
            </div>
            
            <div className="relative w-24 h-16 flex items-end justify-center overflow-hidden">
              <svg className="absolute top-0 w-full h-auto transform rotate-180" viewBox="0 0 100 50">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#E2E8F0" strokeWidth="8" strokeDasharray="4 4" />
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#00e3fd" strokeWidth="8" strokeDashoffset={(1 - stepsGoalPct/100) * 125} strokeDasharray="125" strokeLinecap="round" />
              </svg>
              <span className="font-display text-lg font-bold text-fg z-10">{stepsGoalPct}%</span>
            </div>
            <span className="text-[9px] font-mono text-muted uppercase mt-1">Calorie Target Calibrator</span>
          </div>

          {/* Route Map Placeholder */}
          <div className="glass-card col-span-1 md:col-span-12 lg:col-span-3 p-0 min-h-[160px] overflow-hidden relative group">
            <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur px-2.5 py-1 rounded-md border border-border/30">
              <span className="font-mono text-[9px] font-bold text-fg uppercase">Navigator Route</span>
            </div>
            <div className="absolute inset-0 z-0 bg-slate-100 flex items-center justify-center">
              {/* Minimalist route path SVG mockup */}
              <svg className="w-full h-full text-accent" viewBox="0 0 200 100" preserveAspectRatio="none">
                <path d="M 20 80 Q 80 10 140 70 T 180 20" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <circle cx="180" cy="20" r="4" fill="var(--secondary-container)" />
                <circle cx="20" cy="80" r="3" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Dynamic Target Runway */}
        <div className="glass-card glass-card-lg mb-6">
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
              <span className="meta">Daily Caloric Target</span>
              <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{round0(target)}</div>
            </div>
          </div>
        </div>

        {/* Trajectory verdict card */}
        <div className="glass-card glass-card-lg mb-6 space-y-4">
          <div className="row between">
            <span className="meta">Bayesian Engine Status</span>
            <span className="meta" style={{ color: "var(--accent)" }}>{convergence.isConverged ? "Model Converged" : "Tuning Phase"}</span>
          </div>
          <div className="row between items-end">
            <div>
              <span className="meta">Dynamic Expenditure</span>
              <h2 className="h1 text-accent mt-2 font-bold" style={{ fontSize: 44 }}>
                {round0(currentTdee)} <span className="text-sm font-normal text-muted">kcal/day</span>
              </h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="meta">Stabilization</span>
              <p className="font-body text-sm font-medium text-fg mt-1">
                {convergence.isConverged
                  ? "Bayesian flux stable."
                  : `Tuning: ${convergence.daysRemaining} days until ${convergence.nextAlpha} alpha`}
              </p>
            </div>
          </div>

          {composition && (
            <div className="border-t border-border/20 pt-4 mt-2">
              <div className="row between">
                <div>
                  <span className="meta">Navy Body Fat</span>
                  <div className="num font-bold text-fg text-lg mt-1">{round1(composition.bodyFatPct * 100)}%</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="meta">Lean Mass</span>
                  <div className="num font-bold text-fg text-lg mt-1">{round1(composition.leanMassKg)} kg</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Charts: Weight + TDEE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {history.length > 0 && (
            <section className="glass-card glass-card-lg">
              <div className="row between" style={{ marginBottom: "var(--gap-md)" }}>
                <div>
                  <span className="meta">Posterior Trace · {history.length}-Week Convergence</span>
                  <h3 className="h3" style={{ marginTop: 4 }}>TDEE Expenditure</h3>
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

          <section className="glass-card glass-card-lg">
            <div className="row between" style={{ marginBottom: "var(--gap-md)" }}>
              <div>
                <span className="meta">Weight Log · Raw vs. EWMA Trend</span>
                <h3 className="h3" style={{ marginTop: 4 }}>Body Mass (90 Days)</h3>
              </div>
              <span className="meta">Δ Trend · <span className="num font-semibold text-accent">
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
        </div>

        {/* Weekly audit log table */}
        {history.length > 0 && (
          <section className="space-y-4">
            <div>
              <span className="meta">Bayesian Calibrations</span>
              <h3 className="h3 mt-1">Audit Trail</h3>
            </div>
            <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 0.8fr", gap: "1px", background: "rgba(193, 198, 215, 0.4)" }}>
                <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">Week</span></div>
                <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">Avg Intake</span></div>
                <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">Δ Trend Weight</span></div>
                <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">Inferred TDEE</span></div>
                <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">Posterior TDEE</span></div>
                <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">α</span></div>
                {history.slice().reverse().map((h, idx) => (
                  <AuditRow key={idx} h={h} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

const AuditRow = ({
  h,
}: {
  h: {
    week: { start: string; end: string };
    result: WeeklyTdeeResult;
    posterior: KcalDay;
    alpha: number;
    prior: KcalDay;
  };
}) => {
  const dropped = h.alpha === 0;
  return (
    <>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span className="num" style={{ fontSize: 13 }}>{h.week.start}</span>
        <span className="meta">{pct(h.result.completeness)} complete</span>
      </div>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span className="num" style={{ fontSize: 16 }}>{round0(h.result.avgIntake)}</span>
      </div>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span
          className="num"
          style={{ fontSize: 16, color: h.result.deltaWeightKg < 0 ? "var(--accent)" : "var(--fg)" }}
        >
          {signed(h.result.deltaWeightKg, 2)} kg
        </span>
      </div>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span className="num" style={{ fontSize: 16 }}>{round0(h.result.tdeeWeek)}</span>
      </div>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span className="num" style={{ fontSize: 16, fontWeight: 700, color: dropped ? "var(--muted)" : "var(--accent)" }}>
          {round0(h.posterior)}
        </span>
        <span className="meta">{signed(h.posterior - h.prior)}</span>
      </div>
      <div className="tg-cell" style={{ background: "var(--surface)" }}>
        <span className="num" style={{ fontSize: 16, color: dropped ? "var(--muted)" : "var(--fg)" }}>
          {dropped ? "—" : h.alpha.toFixed(2)}
        </span>
      </div>
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

const getConvergenceStatus = (intake: IntakeEntry[], weights: WeightEntry[], timezone: string) => {
  const today = new Date().toLocaleString("en-US", { timeZone: timezone }).split(',')[0] || "";
  const parts = today.split('/');
  const m = parts[0] || "01";
  const d = parts[1] || "01";
  const y = parts[2] || "2026";
  const todayIso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  
  const start = new Date(`${todayIso}T00:00:00Z`);
  const day = start.getUTCDay();
  const delta = day === 0 ? 6 : day - 1;
  start.setUTCDate(start.getUTCDate() - delta);
  const weekStart = start.toISOString().slice(0, 10);

  const intakeInWeek = intake.filter((i) => i.date >= weekStart && i.date <= todayIso);
  const weightsInWeek = weights.filter((w) => w.date >= weekStart && w.date <= todayIso);

  const intakeDates = new Set(intakeInWeek.map((i) => i.date));
  const weightDates = new Set(weightsInWeek.map((w) => w.date));
  let daysWithBoth = 0;
  for (const date of intakeDates) if (weightDates.has(date)) daysWithBoth++;

  const currentAlpha = daysWithBoth >= 5 ? 0.6 : daysWithBoth >= 3 ? 0.4 : 0;
  const isConverged = currentAlpha >= 0.6;

  let daysRemaining = 0;
  let nextAlpha = currentAlpha;

  if (daysWithBoth < 3) {
    daysRemaining = 3 - daysWithBoth;
    nextAlpha = 0.4;
  } else if (daysWithBoth < 5) {
    daysRemaining = 5 - daysWithBoth;
    nextAlpha = 0.6;
  }

  return { daysRemaining, currentAlpha, nextAlpha, isConverged };
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
    <h1 className="h2" style={{ marginTop: 16 }}>SYNC FAILURE</h1>
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

    <div className="tg" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 32 }}>
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="eyebrow">Path · One</span>
        <span className="h3">Mobile Onboard</span>
        <p className="meta" style={{ color: "var(--muted)", textTransform: "none", letterSpacing: 0, fontSize: 12 }}>
          Install Expo Go, sign in with the same email, complete the Calibration screen.
        </p>
      </div>
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="eyebrow">Path · Two</span>
        <span className="h3">Import History</span>
        <p className="meta" style={{ color: "var(--muted)", textTransform: "none", letterSpacing: 0, fontSize: 12 }}>
          MyFitnessPal export → <Link href="/import" style={{ color: "var(--accent)" }}>/import</Link>.
        </p>
      </div>
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="eyebrow">Path · Three</span>
        <span className="h3">Log Manually</span>
        <p className="meta" style={{ color: "var(--muted)", textTransform: "none", letterSpacing: 0, fontSize: 12 }}>
          Use <Link href="/log-meal" style={{ color: "var(--accent)" }}>/log-meal</Link> on the web.
        </p>
      </div>
    </div>

    <button onClick={onSignOut} className="meta" style={{
      background: "transparent", border: "1px solid var(--border)",
      padding: "12px 24px", color: "var(--fg)", cursor: "pointer", borderRadius: 999,
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
