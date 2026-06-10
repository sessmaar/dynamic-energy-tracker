"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACTIVITY_CATALOG,
  type ActivityKey,
  kg,
  met,
  latestTrendWeight,
  localDateInTimezone,
  activeCalories,
} from "@dynamic-energy/engine";
import { useLocalStore } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";

/** Convert a snake_case catalog key into a human-readable label. */
function keyToLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LogActivityPage() {
  const router = useRouter();
  const profile = useLocalStore((s) => s.profile);
  const tz = profile?.timezone ?? "UTC";
  const today = localDateInTimezone(tz);

  const weights = localRepos.weight.listSince("1970-01-01");
  const trend = latestTrendWeight(weights) ?? (profile ? kg(profile.initialWeightKg) : kg(70));

  const entries = useMemo(
    () => Object.entries(ACTIVITY_CATALOG) as [ActivityKey, number][],
    [],
  );

  const [activityKey, setActivityKey] = useState<ActivityKey>(entries[0]![0]);
  const [duration, setDuration] = useState("30");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metValue = ACTIVITY_CATALOG[activityKey];
  const mins = Number(duration) || 0;
  const kcal = mins > 0 ? Math.round(activeCalories(trend, met(metValue), mins)) : 0;

  const onSubmit = () => {
    if (!mins || mins <= 0) return;
    setBusy(true); setError(null);
    try {
      localRepos.activity.log({
        date,
        activityType: keyToLabel(activityKey),
        metValue,
        durationMin: mins,
        caloriesActive: kcal,
      });
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px 96px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <header>
          <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>Log activity</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>What did you do?</h1>
        </header>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>Activity</span>
          <select
            value={activityKey}
            onChange={(e) => setActivityKey(e.target.value as ActivityKey)}
            style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)", borderRadius: 12, padding: "12px 14px", fontSize: 15 }}
          >
            {entries.map(([key, metVal]) => (
              <option key={key} value={key}>
                {keyToLabel(key)} · {metVal} MET
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>Duration (min)</span>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={{ border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--fg)", fontSize: 32, fontWeight: 800, padding: "4px 0", outline: 0 }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>Date</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)", borderRadius: 12, padding: "12px 14px", fontSize: 15 }}
          />
        </label>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Estimated active calories</div>
          <div style={{ color: "var(--accent)", fontSize: 32, fontWeight: 800 }}>{kcal} kcal</div>
        </div>

        {error && <div style={{ color: "var(--viz-error)", fontSize: 13 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/today" style={btnGhost as React.CSSProperties & { textDecoration: string }}>Cancel</Link>
          <button onClick={onSubmit} disabled={busy || mins <= 0} style={{ ...btnPrimary, opacity: busy || mins <= 0 ? 0.5 : 1 }}>
            {busy ? "Saving…" : "Log activity →"}
          </button>
        </div>
      </div>
    </main>
  );
}

const btnPrimary: React.CSSProperties = { flex: 2, background: "var(--accent)", color: "#fff", border: 0, padding: "14px 20px", fontSize: 16, fontWeight: 700, borderRadius: 999, cursor: "pointer" };
const btnGhost = { flex: 1, background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", padding: "14px 20px", fontSize: 15, fontWeight: 600, borderRadius: 999, cursor: "pointer", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
