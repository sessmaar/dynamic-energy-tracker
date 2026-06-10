"use client";

import Link from "next/link";
import {
  type KcalDay, type WeeklyTdeeResult,
  ageFromDob, cm, computeWeeklyTdee, dailyTargetFromTdee, ewmaTrend, isoDate,
  latestTrendWeight, seedTdee, updateTdeePosterior, years,
} from "@dynamic-energy/engine";
import { LineChart } from "@/components/LineChart";
import { Runway } from "@/components/Runway";
import { pct, round0, signed } from "@/lib/format";
import { useLocalStore } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";

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

  const since = (() => {
    return "1970-01-01";
  })();

  const weights = localRepos.weight.listSince(since);
  const intake = localRepos.intake.listSince(since);

  if (weights.length === 0) {
    return (
      <main className="container section">
        <h1 className="h2">Log a weight to see trends</h1>
        <p style={{ color: "var(--muted)", marginTop: 12 }}>
          <Link href="/log-weight" style={{ color: "var(--accent)" }}>Go to /log-weight</Link>
        </p>
      </main>
    );
  }

  const userProfile = {
    sex: profile.sex,
    age: years(ageFromDob(profile.dateOfBirth, tz)),
    heightCm: cm(profile.heightCm),
  };

  const seedPrior = seedTdee(userProfile, weights[weights.length - 1]!.weight, profile.activityLevel, null);
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
