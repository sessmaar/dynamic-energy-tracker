"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isConfigured, repos, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export default function LogWeightPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) router.replace("/sign-in");
  }, [session, router]);

  if (!isConfigured) {
    return (
      <main className="container section" style={{ textAlign: "center" }}>
        <span className="eyebrow">System · Offline</span>
        <h1 className="h2" style={{ marginTop: 16 }}>BACKEND NOT CONFIGURED</h1>
      </main>
    );
  }

  if (session === undefined || session === null) {
    return (
      <main className="container section" style={{ textAlign: "center" }}>
        <span className="meta" style={{ color: "var(--accent)" }}>Loading…</span>
      </main>
    );
  }

  return <WeightLogger userId={session.user.id} />;
}

function WeightLogger({ userId }: { userId: string }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [weightKg, setWeightKg] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(weightKg) > 0;

  const onSubmit = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await repos.weight.log({
        userId,
        date: date as Parameters<typeof repos.weight.log>[0]["date"],
        weightKg: Number(weightKg),
        note: note.trim() || undefined,
      });
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center p-6"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="w-full" style={{ maxWidth: 480 }}>
        <div className="glass-card glass-card-lg space-y-6">
          <div>
            <span className="eyebrow">Logger · Mass</span>
            <h1 className="h2 mt-2">Log Weight</h1>
            <p className="meta mt-1" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13, color: "var(--muted)" }}>
              Morning fasted weight gives the most consistent readings.
            </p>
          </div>

          <div>
            <label className="meta text-xs mb-2 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              className="input-minimal"
            />
          </div>

          <div>
            <label className="meta text-xs mb-2 block">Weight (kg)</label>
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              min={30}
              max={300}
              step={0.1}
              placeholder="e.g. 82.5"
              autoFocus
              className="input-minimal"
              style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}
            />
          </div>

          <div>
            <label className="meta text-xs mb-2 block">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. post-workout, high sodium day"
              className="input-minimal"
            />
          </div>

          {error && (
            <p style={{ color: "var(--error)", fontSize: 13 }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/dashboard"
              style={{
                flex: 1,
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                padding: "14px 20px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 999,
                cursor: "pointer",
                textAlign: "center",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Cancel
            </Link>
            <button
              onClick={onSubmit}
              disabled={busy || !valid}
              style={{
                flex: 2,
                background: "var(--accent)",
                color: "#ffffff",
                border: 0,
                padding: "14px 20px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 999,
                cursor: "pointer",
                opacity: busy || !valid ? 0.5 : 1,
              }}
            >
              {busy ? "Saving…" : "Log Weight →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
