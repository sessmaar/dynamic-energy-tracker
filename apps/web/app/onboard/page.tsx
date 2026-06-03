"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isConfigured, repos, supabase } from "@/lib/supabase";
import type { ActivityLevel } from "@dynamic-energy/data";
import type { Session } from "@supabase/supabase-js";

type Sex = "male" | "female";
type GoalType = "cut" | "maintain" | "gain";
type Step = "profile" | "goal" | "done";

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; sub: string }[] = [
  { value: "sedentary", label: "Sedentary",   sub: "Desk job, no exercise" },
  { value: "light",     label: "Light",        sub: "1–2 workouts / week" },
  { value: "moderate",  label: "Moderate",     sub: "3–4 workouts / week" },
  { value: "very",      label: "Active",       sub: "5–6 workouts / week" },
  { value: "extra",     label: "Very Active",  sub: "2× daily / physical job" },
];

const GOAL_OPTIONS: { value: GoalType; label: string; sub: string }[] = [
  { value: "cut",      label: "Lose Fat",     sub: "Caloric deficit" },
  { value: "maintain", label: "Maintain",     sub: "Energy balance" },
  { value: "gain",     label: "Build Muscle", sub: "Caloric surplus" },
];

const RATE_OPTIONS: { value: number; label: string }[] = [
  { value: 0.25, label: "0.25 kg / week  (slow, sustainable)" },
  { value: 0.5,  label: "0.5 kg / week   (standard)" },
  { value: 0.75, label: "0.75 kg / week  (moderate)" },
  { value: 1.0,  label: "1.0 kg / week   (aggressive)" },
];

export default function OnboardPage() {
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

  return <OnboardFlow userId={session.user.id} />;
}

function OnboardFlow({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("profile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sex, setSex] = useState<Sex>("male");
  const [dob, setDob] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [timezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  const [goalType, setGoalType] = useState<GoalType>("cut");
  const [rateKgPerWeek, setRateKgPerWeek] = useState(0.5);

  const profileValid =
    sex &&
    /^\d{4}-\d{2}-\d{2}$/.test(dob) &&
    Number(heightCm) > 0 &&
    Number(weightKg) > 0;

  const saveProfile = async () => {
    setBusy(true);
    setError(null);
    try {
      await repos.profile.upsert({
        userId,
        sex,
        dateOfBirth: dob,
        heightCm: Number(heightCm),
        initialWeightKg: Number(weightKg),
        activityLevel,
        timezone,
      });
      await repos.weight.log({
        userId,
        date: new Date().toISOString().slice(0, 10) as Parameters<typeof repos.weight.log>[0]["date"],
        weightKg: Number(weightKg),
        note: "Initial weight (onboarding)",
      });
      setStep("goal");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveGoal = async () => {
    setBusy(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10) as Parameters<typeof repos.goal.setActive>[0]["startDate"];
      await repos.goal.setActive({
        userId,
        goalType,
        rateKgPerWeek: goalType === "maintain" ? 0 : rateKgPerWeek,
        startDate: today,
      });
      setStep("done");
      setTimeout(() => router.replace("/dashboard"), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center p-6"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="flex items-center gap-2 mb-10">
        {(["profile", "goal", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: step === s || (s === "done" && step === "done") ? "var(--accent)" : "var(--surface-container-high)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: step === s ? "#fff" : "var(--muted)",
                transition: "background 0.3s",
              }}
            >
              {i + 1}
            </div>
            {i < 2 && (
              <div style={{ width: 32, height: 2, background: "var(--border)", borderRadius: 1 }} />
            )}
          </div>
        ))}
      </div>

      <div className="w-full" style={{ maxWidth: 480 }}>
        {step === "profile" && (
          <div className="glass-card glass-card-lg space-y-6">
            <div>
              <span className="eyebrow">Step 1 · Calibration</span>
              <h1 className="h2 mt-2">Your Body Profile</h1>
              <p className="meta mt-1" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13, color: "var(--muted)" }}>
                The engine needs these to seed your TDEE estimate.
              </p>
            </div>

            <div>
              <label className="meta text-xs mb-2 block">Biological Sex</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["male", "female"] as Sex[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSex(s)}
                    style={{
                      flex: 1,
                      padding: "10px 16px",
                      borderRadius: 999,
                      border: sex === s ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: sex === s ? "var(--accent-container, rgba(1,105,111,0.1))" : "var(--surface)",
                      color: sex === s ? "var(--accent)" : "var(--muted)",
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="meta text-xs mb-2 block">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="input-minimal"
                max={new Date(Date.now() - 10 * 365.25 * 86400 * 1000).toISOString().slice(0, 10)}
              />
            </div>

            <div>
              <label className="meta text-xs mb-2 block">Height (cm)</label>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                min={100}
                max={250}
                placeholder="e.g. 178"
                className="input-minimal"
              />
            </div>

            <div>
              <label className="meta text-xs mb-2 block">Current Weight (kg)</label>
              <input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                min={30}
                max={300}
                step={0.1}
                placeholder="e.g. 82.5"
                className="input-minimal"
              />
            </div>

            <div>
              <label className="meta text-xs mb-2 block">Activity Level</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ACTIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setActivityLevel(opt.value)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: activityLevel === opt.value ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: activityLevel === opt.value ? "var(--accent-container, rgba(1,105,111,0.08))" : "var(--surface)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14, color: activityLevel === opt.value ? "var(--accent)" : "var(--fg)" }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <p style={{ color: "var(--error)", fontSize: 13 }}>{error}</p>}

            <button onClick={saveProfile} disabled={busy || !profileValid} style={btnPrimary}>
              {busy ? "Saving…" : "Continue →"}
            </button>
          </div>
        )}

        {step === "goal" && (
          <div className="glass-card glass-card-lg space-y-6">
            <div>
              <span className="eyebrow">Step 2 · Objective</span>
              <h1 className="h2 mt-2">Set Your Goal</h1>
              <p className="meta mt-1" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13, color: "var(--muted)" }}>
                The engine will compute a daily caloric target from your TDEE estimate.
              </p>
            </div>

            <div>
              <label className="meta text-xs mb-2 block">Direction</label>
              <div style={{ display: "flex", gap: 8 }}>
                {GOAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGoalType(opt.value)}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "12px 8px",
                      borderRadius: 12,
                      border: goalType === opt.value ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: goalType === opt.value ? "var(--accent-container, rgba(1,105,111,0.1))" : "var(--surface)",
                      cursor: "pointer",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13, color: goalType === opt.value ? "var(--accent)" : "var(--fg)" }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {goalType !== "maintain" && (
              <div>
                <label className="meta text-xs mb-2 block">Weekly Rate</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {RATE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRateKgPerWeek(opt.value)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: rateKgPerWeek === opt.value ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: rateKgPerWeek === opt.value ? "var(--accent-container, rgba(1,105,111,0.08))" : "var(--surface)",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: 13,
                        fontWeight: rateKgPerWeek === opt.value ? 600 : 400,
                        color: rateKgPerWeek === opt.value ? "var(--accent)" : "var(--fg)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p style={{ color: "var(--error)", fontSize: 13 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setStep("profile")}
                style={{ ...btnPrimary, background: "transparent", border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                ← Back
              </button>
              <button onClick={saveGoal} disabled={busy} style={{ ...btnPrimary, flex: 2 }}>
                {busy ? "Saving…" : "Launch Dashboard →"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="glass-card glass-card-lg" style={{ textAlign: "center", padding: "3rem 2rem" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="eyebrow">Calibration Complete</span>
            <h2 className="h2 mt-2">Engine Initialized</h2>
            <p className="meta mt-2" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13, color: "var(--muted)" }}>
              Redirecting to your dashboard…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "#ffffff",
  border: 0,
  padding: "14px 20px",
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 999,
  cursor: "pointer",
  width: "100%",
  textAlign: "center",
  transition: "opacity 0.15s ease",
  flex: 1,
};
