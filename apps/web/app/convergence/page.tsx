"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  type KcalDay, type WeeklyTdeeResult,
  ageFromDob, cm, computeWeeklyTdee, isoDate, seedTdee, updateTdeePosterior, years,
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

  const sinceIso = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 90);
    return d.toISOString().slice(0, 10);
  })();

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
