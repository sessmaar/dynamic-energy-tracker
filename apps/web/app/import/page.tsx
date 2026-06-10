"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ImportPreview, parseMfpCsv } from "@dynamic-energy/data";
import { localRepos } from "@/lib/local-repos";

export default function ImportPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const p = parseMfpCsv(text);
      setPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onCommit = () => {
    if (!preview) return;
    setCommitting(true);
    try {
      for (const m of preview.meals) {
        localRepos.meal.add({
          date: m.date,
          mealType: m.mealType,
          items: [{ name: m.name, grams: m.grams, kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG }],
        });
      }
      for (const w of preview.weights) {
        localRepos.weight.log({ date: w.date, weightKg: w.weightKg });
      }
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCommitting(false);
    }
  };

  return (
    <main className="container section" style={{ maxWidth: 720, paddingBottom: 96 }}>
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">Import</span>
        <h1 className="h2" style={{ marginTop: 4 }}>MyFitnessPal CSV</h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>Drop your MFP food or measurements export. We&apos;ll preview and import to your local store.</p>
      </header>

      <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} style={{ marginBottom: 16 }} />

      {error && <div style={{ color: "var(--viz-error)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {preview && (
        <section className="glass-card glass-card-lg" style={{ marginBottom: 16 }}>
          <p>Meals: <strong>{preview.meals.length}</strong></p>
          <p>Weights: <strong>{preview.weights.length}</strong></p>
          <p>Body measurements: <strong>{preview.bodyMeasurements.length}</strong> (not imported in v1)</p>
          <p style={{ color: "var(--muted)" }}>Skipped rows: {preview.skipped.length}</p>
          <button onClick={onCommit} disabled={committing} style={{ marginTop: 16, background: "var(--accent)", color: "#fff", border: 0, padding: "12px 24px", borderRadius: 999, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {committing ? "Importing…" : "Import to my account"}
          </button>
        </section>
      )}

      <Link href="/today" style={{ color: "var(--accent)" }}>← Today</Link>
    </main>
  );
}
