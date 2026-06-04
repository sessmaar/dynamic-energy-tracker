"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ActivityLevel, type Composition, type IntakeEntry, type KcalDay,
  type WeeklyTdeeResult, type WeightEntry,
  computeWeeklyTdee, isoDate, latestTrendWeight,
  resolveComposition, seedTdee, unit, updateTdeePosterior, cm, years,
} from "@dynamic-energy/engine";
import type { BodyMeasurement } from "@dynamic-energy/data";
import { isConfigured, repos, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { pct, round0, signed } from "@/lib/format";

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
      <div className="container section" style={{ maxWidth: 780 }}>
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
              Latest week: {latestWeek.week.start} → {latestWeek.week.end} · α = {latestWeek.alpha === 0 ? "skipped (low data)" : latestWeek.alpha.toFixed(2)}
            </p>
          )}
          <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
            <button
              onClick={acceptAll}
              disabled={accepting !== null || history.length === 0}
              style={{
                background: "var(--accent)", color: "#fff", border: 0,
                padding: "14px 24px", fontSize: 14, fontWeight: 600,
                borderRadius: 999, cursor: "pointer",
                opacity: accepting !== null ? 0.5 : 1,
              }}
            >
              {accepting !== null ? "Saving…" : `Accept All ${history.length} Week${history.length !== 1 ? "s" : ""} →`}
            </button>
            <Link
              href="/dashboard"
              style={{
                background: "transparent", border: "1px solid var(--border)",
                color: "var(--fg)", padding: "14px 24px", fontSize: 14, fontWeight: 600,
                borderRadius: 999, cursor: "pointer", textDecoration: "none", display: "inline-block",
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Weekly history table */}
        {history.length > 0 && (
          <section>
            <span className="meta" style={{ display: "block", marginBottom: 12 }}>Week-by-Week Audit</span>
            <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 0.7fr 1fr",
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
        )}
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
