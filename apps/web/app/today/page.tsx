"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type Composition, ageFromDob, cm, computeWeeklyTdee, dailyTargetFromTdee,
  isoDate, kg, latestTrendWeight, localDateInTimezone, resolveComposition,
  seedTdee, unit, updateTdeePosterior, years,
} from "@dynamic-energy/engine";
import { useLocalStore } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";

const ringPct = (n: number, d: number): number => (d > 0 ? Math.min(1, Math.max(0, n / d)) : 0);

export default function TodayPage() {
  const router = useRouter();
  const profile = useLocalStore((s) => s.profile);
  const goal = useLocalStore((s) => s.goal);

  if (!profile || !goal) {
    if (typeof window !== "undefined") router.replace("/onboarding");
    return null;
  }

  const tz = profile.timezone || "UTC";
  const today = localDateInTimezone(tz);

  // Engine inputs
  const sinceIso = (() => {
    return "1970-01-01";
  })();

  const weights = localRepos.weight.listSince(sinceIso);
  const intake = localRepos.intake.listSince(sinceIso);

  const trend = latestTrendWeight(weights) ?? (weights.length ? weights[weights.length - 1]!.weight : kg(profile.initialWeightKg));
  const composition: Composition | null = null; // Body composition logging will land in a follow-up.
  const userProfile = {
    sex: profile.sex,
    age: years(ageFromDob(profile.dateOfBirth, tz)),
    heightCm: cm(profile.heightCm),
  };

  // Walk weekly windows from earliest weight to today, applying Bayesian updates.
  const seed = seedTdee(userProfile, trend, profile.activityLevel, composition);
  let posterior = seed;
  if (weights.length > 0) {
    const start = new Date(`${weights[0]!.date}T00:00:00Z`);
    const day = start.getUTCDay();
    const delta = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    start.setUTCDate(start.getUTCDate() + delta);
    const end = new Date(`${today}T00:00:00Z`);
    let cursor = new Date(start);
    while (true) {
      const wkEnd = new Date(cursor);
      wkEnd.setUTCDate(wkEnd.getUTCDate() + 6);
      if (wkEnd > end) break;
      const wk = computeWeeklyTdee(isoDate(cursor.toISOString().slice(0, 10)), isoDate(wkEnd.toISOString().slice(0, 10)), intake, weights);
      const u = updateTdeePosterior(posterior, wk);
      posterior = u.posterior;
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  }

  const signedRate = goal.type === "maintain" ? 0 : goal.type === "cut" ? -goal.rateKgPerWeek : goal.rateKgPerWeek;
  const dailyTarget = dailyTargetFromTdee(posterior, { kgPerWeek: signedRate });

  const todayIntake = intake.find((i) => i.date === today);
  const eaten = todayIntake?.calories ?? 0;
  const left = Math.max(0, Math.round(dailyTarget - eaten));

  const proteinToday = todayIntake?.proteinG ?? 0;
  const carbsToday = todayIntake?.carbsG ?? 0;
  const fatToday = todayIntake?.fatG ?? 0;

  const todayMeals = localRepos.meal.listForDate(today);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px 96px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <header>
          <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>Today</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{new Date(`${today}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h1>
        </header>

        {/* Calories left */}
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Calories left</div>
          <div style={{ color: "var(--accent)", fontSize: 48, fontWeight: 800, lineHeight: 1, marginTop: 4 }}>{left.toLocaleString()}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
            {Math.round(eaten).toLocaleString()} eaten · {Math.round(dailyTarget).toLocaleString()} target
          </div>
        </section>

        {/* Macros */}
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, display: "flex", gap: 16 }}>
          <MacroBar label="Protein" value={proteinToday ?? 0} target={goal.proteinG} color="var(--viz-protein)" />
          <MacroBar label="Carbs"   value={carbsToday ?? 0} target={goal.carbsG} color="var(--viz-carbs)" />
          <MacroBar label="Fat"     value={fatToday ?? 0} target={goal.fatG} color="var(--viz-fat)" />
        </section>

        {/* Quick actions */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ActionLink href="/log-meal" label="Log food" />
          <ActionLink href="/log-weight" label="Log weight" />
          <ActionLink href="/log-activity" label="Log activity" />
          <ActionLink href="/profile" label="Profile" />
        </section>

        {/* Today's log */}
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Today's log</div>
          {todayMeals.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>Nothing logged yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {todayMeals.map((m) => {
                const totals = m.items.reduce((acc, i) => ({ kcal: acc.kcal + i.kcal, p: acc.p + (i.proteinG ?? 0), c: acc.c + (i.carbsG ?? 0), f: acc.f + (i.fatG ?? 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{m.items.map((i) => i.name).join(", ") || m.mealType}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{m.mealType}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(totals.kcal)} kcal</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>P {Math.round(totals.p)} · C {Math.round(totals.c)} · F {Math.round(totals.f)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const MacroBar = ({ label, value, target, color }: { label: string; value: number; target: number; color: string }) => (
  <div style={{ flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
      <span>{label}</span><span>{Math.round(value)} / {target}g</span>
    </div>
    <div style={{ height: 8, background: "var(--surface-container)", borderRadius: 999, marginTop: 6, overflow: "hidden" }}>
      <div style={{ height: 8, width: `${Math.round(ringPct(value, target) * 100)}%`, background: color, borderRadius: 999 }} />
    </div>
  </div>
);

const ActionLink = ({ href, label }: { href: string; label: string }) => (
  <Link href={href} style={{
    display: "block", padding: "16px 20px", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, color: "var(--fg)", fontSize: 15, fontWeight: 600, textDecoration: "none",
  }}>
    {label}
  </Link>
);
