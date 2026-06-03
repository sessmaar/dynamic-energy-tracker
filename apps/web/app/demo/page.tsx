import Link from "next/link";
import {
  type KcalDay, type WeeklyTdeeResult,
  DEFAULT_ACTIVITY_LEVEL,
  cm, computeWeeklyTdee, dailyTargetFromTdee, ewmaTrend, isoDate,
  kg, mifflinStJeor, seedTdee, updateTdeePosterior, years,
} from "@dynamic-energy/engine";
import { LineChart } from "@/components/LineChart";
import { Runway } from "@/components/Runway";
import { Sparkline } from "@/components/Sparkline";
import { pct, round0, round1, signed } from "@/lib/format";
import { seedDataset, weeklyWindows } from "@/lib/seed";

/**
 * Convergence Engine Console Demo.
 *
 * Runs the engine end-to-end on every request against deterministic seeded data.
 * Useful for reviewing calculations.
 */
export default function ConsolePage() {
  const data = seedDataset(12);
  const windows = weeklyWindows(data.startDate, data.today);

  const profile = { sex: "male" as const, age: years(34), heightCm: cm(180) };
  const seedPrior = seedTdee(profile, kg(data.profile.startWeightKg), DEFAULT_ACTIVITY_LEVEL);

  const history: Array<{
    week: { start: string; end: string };
    result: WeeklyTdeeResult;
    prior: KcalDay;
    posterior: KcalDay;
    alpha: number;
  }> = [];

  let prior = seedPrior;
  for (const w of windows) {
    const result = computeWeeklyTdee(isoDate(w.start), isoDate(w.end), data.intake, data.weights);
    const updated = updateTdeePosterior(prior, result);
    history.push({ week: w, result, prior, posterior: updated.posterior, alpha: updated.alpha });
    prior = updated.posterior;
  }

  const currentTdee = history[history.length - 1]?.posterior ?? seedPrior;
  const currentTarget = dailyTargetFromTdee(currentTdee, { kgPerWeek: data.profile.goalKgPerWeek });

  // TDEE posterior line
  const tdeeSeries = history.map((h, i) => ({
    x: i / Math.max(history.length - 1, 1),
    y: h.posterior,
  }));
  const tdeeAll = [...tdeeSeries.map((p) => p.y), data.profile.trueTdee, Number(seedPrior)];
  const tdeeMin = Math.min(...tdeeAll) - 50;
  const tdeeMax = Math.max(...tdeeAll) + 50;

  // Weight
  const trend = ewmaTrend(data.weights);
  const weightScatter = data.weights.map((w, i) => ({
    x: i / Math.max(data.weights.length - 1, 1),
    y: w.weight,
  }));
  const weightTrend = trend.map((t, i) => ({
    x: i / Math.max(trend.length - 1, 1),
    y: t.trend,
  }));
  const weightAll = [...weightScatter.map((p) => p.y), ...weightTrend.map((p) => p.y)];
  const weightMin = Math.min(...weightAll) - 0.5;
  const weightMax = Math.max(...weightAll) + 0.5;

  // Last 7 days of intake
  const last7Intake = data.intake.slice(-7);
  const todayIntake = last7Intake[last7Intake.length - 1]!.calories;
  const fillFraction = todayIntake / currentTarget;
  const intakeBars = last7Intake.map((i) => i.calories / Math.max(...last7Intake.map((x) => x.calories)));

  const bmrNow = mifflinStJeor(profile, kg(data.weights[data.weights.length - 1]!.weight));
  const convergedDelta = Math.abs(
    (history[history.length - 1]?.posterior ?? 0) - (history[history.length - 2]?.posterior ?? 0),
  );

  return (
    <>
      {/* Top nav */}
      <header className="topnav">
        <div className="container topnav-inner">
          <span className="topnav-logo" style={{ color: "var(--accent)" }}>
            DENSE MATRIX
          </span>
          <nav>
            <Link href="/" className="active">Product</Link>
            <Link href="/dashboard">Console</Link>
            <Link href="/demo">Demo Engine</Link>
          </nav>
        </div>
      </header>

      <main className="container section">
        {/* Hero header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--gap-lg)" }}>
          <div>
            <span className="eyebrow">Engine Trace · Bayesian Sandbox</span>
            <h1 className="h1" style={{ marginTop: 16 }}>Convergence Demo</h1>
            <p style={{ color: "var(--muted)", maxWidth: 540, marginTop: 16 }}>
              Twelve-week Bayesian audit of inferred TDEE against logged intake and trend mass.
              Calculates in real-time server-side using deterministic seed data.
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="meta">Window · {data.startDate} → {data.today}</span>
            <div className="num bignum" style={{ color: "var(--accent)", marginTop: 8 }}>
              {round0(currentTdee)}
            </div>
            <span className="meta">Inferred TDEE · KCAL/D</span>
          </div>
        </div>

        {/* Metrics strip */}
        <div className="tg" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: "var(--gap-lg)" }}>
          <div className="glass-card tg-cell">
            <span className="meta">Current BMR</span>
            <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>
              {round0(bmrNow)} <span className="meta">KCAL/D</span>
            </span>
            <Sparkline values={intakeBars.map(() => 0.5 + 0.05 * Math.random())} activeFrom={6} />
          </div>
          <div className="glass-card tg-cell">
            <span className="meta">Daily Target</span>
            <span className="num" style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>
              {round0(currentTarget)} <span className="meta" style={{ color: "var(--accent)" }}>KCAL/D</span>
            </span>
            <span className="meta">{signed(data.profile.goalKgPerWeek, 1)} kg/wk goal</span>
          </div>
          <div className="glass-card tg-cell">
            <span className="meta">Posterior Drift · Δ7d</span>
            <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>
              {round0(convergedDelta)} <span className="meta">KCAL/D</span>
            </span>
            <span className="meta">
              {convergedDelta < 100 ? "Engine converged" : "Still tuning"}
            </span>
          </div>
          <div className="glass-card tg-cell">
            <span className="meta">Audit Coverage</span>
            <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>
              {pct(history.reduce((s, h) => s + h.result.completeness, 0) / Math.max(history.length, 1))}
            </span>
            <span className="meta">{history.length} weekly windows</span>
          </div>
        </div>

        {/* Runway */}
        <div className="glass-card glass-card-lg" style={{ marginBottom: "var(--gap-lg)" }}>
          <div className="row between" style={{ marginBottom: "var(--gap-md)" }}>
            <span className="meta">Today · Energy Flux Runway</span>
            <span className="num" style={{ fontSize: 13, color: todayIntake > currentTarget ? "var(--fg)" : "var(--accent)" }}>
              {signed(todayIntake - currentTarget)} <span className="meta">NET</span>
            </span>
          </div>
          <Runway fillFraction={fillFraction} targetFraction={1} />
          <div className="row between" style={{ marginTop: "var(--gap-md)", alignItems: "flex-end" }}>
            <div>
              <span className="meta">Logged</span>
              <div className="bignum">{round0(todayIntake)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="meta">Target</span>
              <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{round0(currentTarget)}</div>
            </div>
          </div>
        </div>

        {/* TDEE convergence chart */}
        <section id="tdee" className="glass-card glass-card-lg" style={{ marginBottom: "var(--gap-lg)" }}>
          <div className="row between" style={{ marginBottom: "var(--gap-md)" }}>
            <div>
              <span className="meta">Posterior Trace · 12-Week Convergence</span>
              <h3 className="h3" style={{ marginTop: 4 }}>TDEE Estimate vs. Truth</h3>
            </div>
            <span className="meta">
              True TDEE · <span className="num" style={{ color: "var(--accent)" }}>{round0(data.profile.trueTdee)}</span>
            </span>
          </div>
          <LineChart
            series={tdeeSeries}
            yMin={tdeeMin}
            yMax={tdeeMax}
            yTopLabel={`${round0(tdeeMax)} KCAL/D`}
            yBottomLabel={`${round0(tdeeMin)} KCAL/D`}
            xStartLabel={data.startDate}
            xEndLabel={data.today}
          />
        </section>

        {/* Weight chart */}
        <section id="weight" className="glass-card glass-card-lg" style={{ marginBottom: "var(--gap-lg)" }}>
          <div className="row between" style={{ marginBottom: "var(--gap-md)" }}>
            <div>
              <span className="meta">Weight Log · Raw vs. EWMA Trend</span>
              <h3 className="h3" style={{ marginTop: 4 }}>Body Mass · 84 Days</h3>
            </div>
            <span className="meta">
              Δ Trend · <span className="num" style={{ color: "var(--accent)" }}>
                {signed(weightTrend[weightTrend.length - 1]!.y - weightTrend[0]!.y, 1)} kg
              </span>
            </span>
          </div>
          <LineChart
            series={weightTrend}
            scatter={weightScatter}
            yMin={weightMin}
            yMax={weightMax}
            yTopLabel={`${round1(weightMax)} kg`}
            yBottomLabel={`${round1(weightMin)} kg`}
            xStartLabel={data.startDate}
            xEndLabel={data.today}
          />
        </section>

        {/* Weekly audit log */}
        <section id="audit">
          <div style={{ marginBottom: "var(--gap-md)" }}>
            <span className="meta">Bayesian Audit Log</span>
            <h3 className="h3" style={{ marginTop: 4 }}>Per-Week Posterior Updates</h3>
          </div>
          <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 0.8fr", gap: "1px", background: "rgba(193, 198, 215, 0.4)" }}>
              <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">Week</span></div>
              <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">Avg Intake</span></div>
              <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">Δ Trend Mass</span></div>
              <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">Inferred TDEE</span></div>
              <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">Posterior</span></div>
              <div className="tg-cell" style={{ background: "var(--surface)" }}><span className="meta">α</span></div>
              {history.slice().reverse().map((h, i) => (
                <Row key={i} h={h} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: "var(--hairline)", marginTop: "var(--gap-xl)" }}>
        <div className="container" style={{ padding: "32px 16px", display: "flex", justifyContent: "space-between" }}>
          <span className="meta">© 2026 Dense Matrix Systems · Convergence Engine</span>
          <span className="meta">Interactive Preview</span>
        </div>
      </footer>
    </>
  );
}

const Row = ({
  h,
}: {
  h: {
    week: { start: string; end: string };
    result: WeeklyTdeeResult;
    prior: KcalDay;
    posterior: KcalDay;
    alpha: number;
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
