"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { localDateInTimezone } from "@dynamic-energy/engine";
import { useLocalStore } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";

export default function LogWeightPage() {
  const router = useRouter();
  const tz = useLocalStore((s) => s.profile?.timezone ?? "UTC");
  const today = localDateInTimezone(tz);

  const [date, setDate] = useState(today);
  const [weightKg, setWeightKg] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(weightKg) > 0;

  const onSubmit = () => {
    if (!valid) return;
    setBusy(true); setError(null);
    try {
      localRepos.weight.log({ date, weightKg: Number(weightKg), note: note.trim() || undefined });
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", padding: "24px 16px 96px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <header>
          <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>Log weight</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Today&apos;s reading</h1>
        </header>

        <Field label="Date" type="date" value={date} onChange={setDate} max={today} />
        <Field label="Weight (kg)" type="number" value={weightKg} onChange={setWeightKg} placeholder="e.g. 82.5" big />
        <Field label="Note (optional)" type="text" value={note} onChange={setNote} placeholder="post-workout, high sodium…" />

        {error && <div style={{ color: "var(--viz-error)", fontSize: 13 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/today" style={btnGhost as React.CSSProperties & { textDecoration: string }}>Cancel</Link>
          <button onClick={onSubmit} disabled={busy || !valid} style={{ ...btnPrimary, opacity: busy || !valid ? 0.5 : 1 }}>
            {busy ? "Saving…" : "Log weight →"}
          </button>
        </div>
      </div>
    </main>
  );
}

const Field = ({ label, type, value, onChange, unit, placeholder, max, big }: {
  label: string; type: "text" | "number" | "date"; value: string; onChange: (v: string) => void;
  unit?: string; placeholder?: string; max?: string; big?: boolean;
}) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>{label}</span>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} max={max}
        style={{ flex: 1, border: 0, outline: 0, background: "transparent", color: "var(--fg)", fontSize: big ? 32 : 22, fontWeight: 800, padding: 0 }}
      />
      {unit && <span style={{ color: "var(--muted)", fontSize: 14, fontWeight: 600 }}>{unit}</span>}
    </div>
  </label>
);

const btnPrimary: React.CSSProperties = { flex: 2, background: "var(--accent)", color: "#fff", border: 0, padding: "14px 20px", fontSize: 16, fontWeight: 700, borderRadius: 999, cursor: "pointer" };
const btnGhost = { flex: 1, background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", padding: "14px 20px", fontSize: 15, fontWeight: 600, borderRadius: 999, cursor: "pointer", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
