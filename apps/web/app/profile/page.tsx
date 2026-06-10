"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalStore, initialLocalState, type LocalState } from "@/lib/local-store";

export default function ProfilePage() {
  const router = useRouter();
  const profile = useLocalStore((s) => s.profile);
  const goal = useLocalStore((s) => s.goal);
  const geminiApiKey = useLocalStore((s) => s.geminiApiKey);
  const setGeminiApiKey = useLocalStore((s) => s.setGeminiApiKey);
  
  const loadState = useLocalStore((s) => s.loadState);
  const reset = useLocalStore((s) => s.reset);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey || "");

  const onExport = () => {
    const snapshot = useLocalStore.getState();
    const data: LocalState = {
      schemaVersion: 1,
      profile: snapshot.profile,
      goal: snapshot.goal,
      weights: snapshot.weights,
      meals: snapshot.meals,
      activities: snapshot.activities,
      engineWeeks: snapshot.engineWeeks,
      foodsCache: snapshot.foodsCache,
      geminiApiKey: snapshot.geminiApiKey,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `det-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as LocalState;
      if (data.schemaVersion !== 1) throw new Error(`Unsupported schema v${data.schemaVersion}`);
      loadState({ ...initialLocalState, ...data });
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onSaveApiKey = () => {
    setGeminiApiKey(apiKeyInput.trim() || undefined);
    alert("API Key saved locally.");
  };

  const onReset = () => {
    if (!confirm("This wipes everything (profile, weights, meals, activity). Continue?")) return;
    reset();
    router.replace("/onboarding");
  };

  return (
    <main className="container section" style={{ maxWidth: 540, paddingBottom: 96 }}>
      <header style={{ marginBottom: 24 }}>
        <span className="eyebrow">Profile</span>
        <h1 className="h2" style={{ marginTop: 4 }}>Settings</h1>
      </header>

      {profile && goal && (
        <section className="glass-card glass-card-lg" style={{ marginBottom: 16 }}>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Current</div>
          <div style={{ marginTop: 8, fontSize: 15 }}>
            <div>{profile.sex} · born {profile.dateOfBirth}</div>
            <div>{profile.heightCm} cm · started at {profile.initialWeightKg} kg</div>
            <div>{profile.activityLevel} · goal: {goal.type} {goal.rateKgPerWeek} kg/wk</div>
            <div>targets: P {goal.proteinG}g · C {goal.carbsG}g · F {goal.fatG}g</div>
          </div>
          <Link href="/onboarding" style={{ display: "inline-block", marginTop: 12, color: "var(--accent)" }}>Re-run onboarding</Link>
        </section>
      )}

      <section className="glass-card glass-card-lg" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>AI Coach</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>Enter your Gemini API key to enable the AI coach. The key is stored only in your browser.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input 
            type="password" 
            placeholder="AIZA..." 
            value={apiKeyInput} 
            onChange={(e) => setApiKeyInput(e.target.value)} 
            style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)", fontSize: 14 }}
          />
          <button onClick={onSaveApiKey} style={{ ...btn, background: "var(--accent)", color: "#fff", border: 0 }}>Save</button>
        </div>
      </section>

      <section className="glass-card glass-card-lg" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>External Data</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>Import your history from Fitia or MyFitnessPal.</p>
        <Link href="/import" style={{ ...btn, display: "inline-block", textAlign: "center", textDecoration: "none", background: "var(--surface-container)", color: "var(--fg)" }}>
          Import from other apps
        </Link>
      </section>

      <section className="glass-card glass-card-lg" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Backup</h3>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Your data lives in your browser. Export regularly so you don't lose it.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={onExport} style={btn}>Export JSON</button>
          <button onClick={() => fileRef.current?.click()} style={btn}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); }} />
        </div>
        {error && <div style={{ color: "var(--viz-error)", fontSize: 13, marginTop: 8 }}>{error}</div>}
      </section>

      <section className="glass-card glass-card-lg">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Danger zone</h3>
        <button onClick={onReset} style={{ ...btn, background: "var(--viz-error)", color: "#fff", borderColor: "var(--viz-error)" }}>Wipe everything</button>
      </section>

      <Link href="/today" style={{ display: "inline-block", marginTop: 24, color: "var(--accent)" }}>← Today</Link>
    </main>
  );
}

const btn: React.CSSProperties = {
  background: "var(--surface)", color: "var(--fg)", border: "1px solid var(--border)",
  padding: "10px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
};
