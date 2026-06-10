"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ImportPreview, parseMfpCsv } from "@dynamic-energy/data";
import { localRepos } from "@/lib/local-repos";

export default function ImportPage() {
  const router = useRouter();
  
  // MFP State
  const [mfpPreview, setMfpPreview] = useState<ImportPreview | null>(null);
  
  // Fitia State
  const [fitiaData, setFitiaData] = useState<any | null>(null);
  const [fitiaCommitPreview, setFitiaCommitPreview] = useState<any | null>(null);

  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onMfpFile = async (file: File) => {
    setError(null);
    setFitiaData(null);
    try {
      const text = await file.text();
      const p = parseMfpCsv(text);
      setMfpPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onFitiaFile = async (file: File) => {
    setError(null);
    setMfpPreview(null);
    try {
      const { parseFitiaXlsx, commitFitiaImport } = await import("@/lib/importers/fitia");
      const buffer = await file.arrayBuffer();
      const data = parseFitiaXlsx(buffer);
      setFitiaData(data);
      // Dry run for counts
      const preview = commitFitiaImport(data, {
        meal: { add: () => {}, listForDate: (d) => localRepos.meal.listForDate(d) },
        weight: { log: () => {}, listSince: (d) => localRepos.weight.listSince(d) }
      });
      setFitiaCommitPreview(preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onCommitMfp = () => {
    if (!mfpPreview) return;
    setCommitting(true);
    try {
      for (const m of mfpPreview.meals) {
        localRepos.meal.add({
          date: m.date,
          mealType: m.mealType,
          items: [{ name: m.name, grams: m.grams, kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG }],
        });
      }
      for (const w of mfpPreview.weights) {
        localRepos.weight.log({ date: w.date, weightKg: w.weightKg });
      }
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCommitting(false);
    }
  };

  const onCommitFitia = async () => {
    if (!fitiaData) return;
    setCommitting(true);
    try {
      const { commitFitiaImport } = await import("@/lib/importers/fitia");
      commitFitiaImport(fitiaData, localRepos);
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCommitting(false);
    }
  };

  return (
    <main className="container section" style={{ maxWidth: 720, paddingBottom: 96 }}>
      <header style={{ marginBottom: 32 }}>
        <span className="eyebrow">Import</span>
        <h1 className="h2" style={{ marginTop: 4 }}>History & Data</h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>Bring your historical data from other apps. Everything stays local in your browser.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Fitia Section */}
        <section className="glass-card glass-card-lg">
          <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 0 }}>Fitia</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>Import from an Excel export (.xlsx).</p>
          <input type="file" accept=".xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFitiaFile(f); }} style={{ fontSize: 12 }} />
        </section>

        {/* MFP Section */}
        <section className="glass-card glass-card-lg">
          <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 0 }}>MyFitnessPal</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>Import from a CSV export (.csv).</p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onMfpFile(f); }} style={{ fontSize: 12 }} />
        </section>
      </div>

      {error && <div style={{ color: "var(--viz-error)", fontSize: 13, marginBottom: 24, padding: 12, background: "rgba(224, 49, 49, 0.1)", borderRadius: 8 }}>{error}</div>}

      {/* Fitia Preview */}
      {fitiaData && fitiaCommitPreview && (
        <section className="glass-card glass-card-lg" style={{ marginBottom: 32, borderColor: "var(--accent)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, color: "var(--accent)" }}>Fitia Import Preview</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Days to add</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{fitiaCommitPreview.addedDays}</div>
              {fitiaCommitPreview.skippedDays > 0 && <div style={{ fontSize: 11, color: "var(--muted)" }}>{fitiaCommitPreview.skippedDays} already exist</div>}
            </div>
            <div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Weights to add</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{fitiaCommitPreview.addedWeights}</div>
              {fitiaCommitPreview.skippedWeights > 0 && <div style={{ fontSize: 11, color: "var(--muted)" }}>{fitiaCommitPreview.skippedWeights} already exist</div>}
            </div>
          </div>
          <button onClick={onCommitFitia} disabled={committing} style={btnPrimary}>
            {committing ? "Importing…" : "Commit Fitia data"}
          </button>
        </section>
      )}

      {/* MFP Preview */}
      {mfpPreview && (
        <section className="glass-card glass-card-lg" style={{ marginBottom: 32, borderColor: "var(--accent)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, color: "var(--accent)" }}>MFP Import Preview</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Meals</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{mfpPreview.meals.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Weights</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{mfpPreview.weights.length}</div>
            </div>
          </div>
          <button onClick={onCommitMfp} disabled={committing} style={btnPrimary}>
            {committing ? "Importing…" : "Commit MFP data"}
          </button>
        </section>
      )}

      <Link href="/today" style={{ color: "var(--accent)", fontSize: 14, fontWeight: 600 }}>← Back to Today</Link>
    </main>
  );
}

const btnPrimary: React.CSSProperties = {
  marginTop: 24, background: "var(--accent)", color: "#fff", border: 0,
  padding: "14px 24px", borderRadius: 999, fontSize: 15, fontWeight: 700,
  cursor: "pointer", width: "100%"
};
