"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type ImportPreview, parseMfpCsv } from "@dynamic-energy/data";
import { isoDate } from "@dynamic-energy/engine";
import { isConfigured, repos, supabase } from "@/lib/supabase";
import { round0 } from "@/lib/format";
import type { Session } from "@supabase/supabase-js";

/**
 * Phase 3c import UX. Three states linear: pick file → review preview →
 * commit. The parser runs entirely in the browser; only the commit step
 * touches Supabase. Skipped rows surface in a collapsed table so users
 * can see exactly what was dropped before they commit.
 */
export default function ImportPage() {
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

  if (!isConfigured) {
    return <Shell><Empty title="BACKEND NOT CONFIGURED" body="Set NEXT_PUBLIC_SUPABASE_* in apps/web/.env.local." /></Shell>;
  }
  if (session === undefined || session === null) return <Shell><Empty title="…" body="Restoring session." /></Shell>;

  return <Shell><Importer userId={session.user.id} /></Shell>;
}

// ------------------------------------------------------------------------

const Importer = ({ userId }: { userId: string }) => {
  const [filename, setFilename] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState<{ meals: number; weights: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const onPick = async (file: File) => {
    setError(null);
    setCommitted(null);
    try {
      const text = await file.text();
      const p = parseMfpCsv(text);
      setFilename(file.name);
      setPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    setError(null);
    try {
      // Meals: one quick_add meal per row. We don't try to group same-meal
      // entries because MFP exports a separate row per food anyway.
      for (const m of preview.meals) {
        await repos.meal.logMeal({
          userId,
          date: isoDate(m.date),
          mealType: m.mealType,
          items: [{
            name: m.name,
            grams: m.grams ?? undefined,
            kcal: m.kcal,
            proteinG: m.proteinG ?? undefined,
            carbsG: m.carbsG ?? undefined,
            fatG: m.fatG ?? undefined,
          }],
        });
      }
      for (const w of preview.weights) {
        await repos.weight.log({ userId, date: isoDate(w.date), weightKg: w.weightKg });
      }
      setCommitted({ meals: preview.meals.length, weights: preview.weights.length });
      setPreview(null);
      setFilename(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: "var(--gap-lg)" }}>
        <span className="eyebrow">Migration · External Source</span>
        <h1 className="h1" style={{ marginTop: 16 }}>IMPORT</h1>
        <p style={{ color: "var(--muted)", maxWidth: 560, marginTop: 16 }}>
          Upload an MFP export (food diary or measurements). The parser runs
          locally; rows preview before any write to the backend.
        </p>
      </div>

      {!preview && !committed && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void onPick(f);
          }}
          onClick={() => fileInput.current?.click()}
          className="dot-grid"
          style={{
            border: "0.5px dashed var(--border)",
            padding: "80px 24px",
            textAlign: "center",
            cursor: "pointer",
            background: "var(--surface)",
          }}
        >
          <span className="eyebrow">Drop CSV · or click</span>
          <p style={{ color: "var(--muted)", marginTop: 16, fontSize: 13 }}>
            MyFitnessPal exports: Settings → Export Data → Email me a copy
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPick(f);
            }}
          />
        </div>
      )}

      {preview && (
        <>
          <div className="row between" style={{ marginBottom: "var(--gap-md)" }}>
            <span className="meta">Source · <span className="num" style={{ color: "var(--fg)" }}>{filename}</span></span>
            <button
              onClick={() => { setPreview(null); setFilename(null); }}
              className="meta"
              style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--muted)" }}
            >
              ← Different File
            </button>
          </div>

          <div className="tg tg-3" style={{ marginBottom: "var(--gap-lg)" }}>
            <Cell label="Meals · parsed" value={round0(preview.meals.length)} accent />
            <Cell label="Weights · parsed" value={round0(preview.weights.length)} accent />
            <Cell label="Skipped" value={round0(preview.skipped.length)} muted={preview.skipped.length === 0} />
          </div>

          {preview.meals.length > 0 && (
            <Section title={`Meals · ${preview.meals.length} (showing first 8)`}>
              <Table
                headers={["Date", "Slot", "Food", "kcal", "P", "C", "F"]}
                rows={preview.meals.slice(0, 8).map((m) => [
                  m.date,
                  m.mealType,
                  m.name,
                  m.kcal.toString(),
                  m.proteinG?.toString() ?? "—",
                  m.carbsG?.toString() ?? "—",
                  m.fatG?.toString() ?? "—",
                ])}
              />
            </Section>
          )}

          {preview.weights.length > 0 && (
            <Section title={`Weights · ${preview.weights.length} (showing first 8)`}>
              <Table
                headers={["Date", "Weight (kg)"]}
                rows={preview.weights.slice(0, 8).map((w) => [w.date, w.weightKg.toFixed(2)])}
              />
            </Section>
          )}

          {preview.skipped.length > 0 && (
            <Section title={`Skipped · ${preview.skipped.length}`}>
              <Table
                headers={["Line", "Reason", "Raw"]}
                rows={preview.skipped.slice(0, 5).map((s) => [s.line.toString(), s.reason, s.raw])}
              />
            </Section>
          )}

          {error && <p className="meta" style={{ color: "var(--accent)", marginTop: 16 }}>{error}</p>}

          <div className="col" style={{ gap: "var(--gap-md)", marginTop: "var(--gap-lg)" }}>
            <button
              onClick={onCommit}
              disabled={committing || (preview.meals.length === 0 && preview.weights.length === 0)}
              style={btnPrimary}
            >
              {committing ? "Committing…" : "Commit Import"}
            </button>
            <Link href="/dashboard" style={btnSecondaryLink}>Cancel</Link>
          </div>
        </>
      )}

      {committed && (
        <div className="card card-lg col" style={{ gap: "var(--gap-md)" }}>
          <span className="eyebrow">Status · Committed</span>
          <span className="h3">{committed.meals + committed.weights} rows written</span>
          <p style={{ color: "var(--muted)" }}>
            {committed.meals} meals · {committed.weights} weights synced to the backend.
            The engine will pick them up on next dashboard load.
          </p>
          <Link href="/dashboard" style={btnPrimaryLink}>Return to Dashboard</Link>
        </div>
      )}
    </>
  );
};

// ------------------------------------------------------------------------

const Shell = ({ children }: { children: React.ReactNode }) => (
  <>
    <header className="topnav">
      <div className="container topnav-inner">
        <span className="topnav-logo">DET<span style={{ color: "var(--accent)" }}>·</span>CONSOLE</span>
        <nav>
          <Link href="/">Demo</Link>
          <Link href="/dashboard">Live</Link>
          <Link href="/import" className="active">Import</Link>
        </nav>
      </div>
    </header>
    <main className="container section" style={{ maxWidth: 960 }}>{children}</main>
  </>
);

const Cell = ({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) => (
  <div className="tg-cell">
    <span className="meta">{label}</span>
    <span
      className="num"
      style={{
        fontSize: 28, fontWeight: 800,
        color: accent ? "var(--accent)" : muted ? "var(--muted)" : "var(--fg)",
      }}
    >
      {value}
    </span>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: "var(--gap-lg)" }}>
    <span className="meta" style={{ display: "block", marginBottom: 8 }}>{title}</span>
    {children}
  </section>
);

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div style={{ border: "0.5px solid var(--border)", overflow: "hidden" }}>
    <div className="row" style={{ background: "var(--surface)", gap: 0 }}>
      {headers.map((h, i) => (
        <div key={i} style={{ flex: 1, padding: "10px 12px", borderRight: i < headers.length - 1 ? "0.5px solid var(--border)" : 0 }}>
          <span className="meta">{h}</span>
        </div>
      ))}
    </div>
    {rows.map((row, ri) => (
      <div key={ri} className="row" style={{ gap: 0, borderTop: "0.5px solid var(--border)" }}>
        {row.map((cell, ci) => (
          <div key={ci} style={{ flex: 1, padding: "10px 12px", borderRight: ci < row.length - 1 ? "0.5px solid var(--border)" : 0 }}>
            <span className="num" style={{ fontSize: 13 }}>{cell}</span>
          </div>
        ))}
      </div>
    ))}
  </div>
);

const Empty = ({ title, body }: { title: string; body: string }) => (
  <>
    <span className="eyebrow">System</span>
    <h1 className="h2" style={{ marginTop: 16 }}>{title}</h1>
    <p style={{ color: "var(--muted)", marginTop: 24 }}>{body}</p>
  </>
);

const btnPrimary: React.CSSProperties = {
  background: "var(--accent)", color: "var(--bg)", border: "0.5px solid var(--accent)",
  padding: "16px 24px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
  letterSpacing: "0.18em", fontSize: 12, fontWeight: 700, borderRadius: 4, cursor: "pointer",
};
const btnSecondaryLink: React.CSSProperties = {
  background: "var(--surface)", color: "var(--fg)", border: "0.5px solid var(--border)",
  padding: "16px 24px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
  letterSpacing: "0.18em", fontSize: 12, fontWeight: 700, borderRadius: 4, textAlign: "center",
};
const btnPrimaryLink: React.CSSProperties = {
  ...btnPrimary, textDecoration: "none", display: "inline-block", textAlign: "center", marginTop: 12,
};
