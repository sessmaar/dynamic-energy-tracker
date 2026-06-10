"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  type KcalDay, type WeeklyTdeeResult,
  ageFromDob, cm, computeWeeklyTdee, isoDate, seedTdee, updateTdeePosterior, years,
} from "@dynamic-energy/engine";
import { useLocalStore } from "@/lib/local-store";
import { localRepos } from "@/lib/local-repos";
import { pct, round0, signed } from "@/lib/format";
import { GoogleGenerativeAI } from "@google/generative-ai";

type Week = { week: { start: string; end: string }; result: WeeklyTdeeResult; posterior: KcalDay; alpha: number; prior: KcalDay };

export default function ConvergencePage() {
  const router = useRouter();
  const profile = useLocalStore((s) => s.profile);
  const upsertEngineWeek = useLocalStore((s) => s.upsertEngineWeek);
  const geminiApiKey = useLocalStore((s) => s.geminiApiKey);

  const [accepting, setAccepting] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  if (!profile) { if (typeof window !== "undefined") router.replace("/onboarding"); return null; }
  const tz = profile.timezone || "UTC";

  const sinceIso = "1970-01-01";

  const weights = localRepos.weight.listSince(sinceIso);
  const intake = localRepos.intake.listSince(sinceIso);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const onChat = async () => {
    if (!input.trim() || !geminiApiKey || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      const context = localRepos.coach.getContext();
      const systemPrompt = `You are a personalized metabolic health coach for the "Dynamic Energy Tracker" app.
Your tone is encouraging, scientific, and concise.

User context:
${context}

Instructions:
1. Provide advice based on the user data provided.
2. If they are losing weight too fast or slow compared to their goal, suggest small adjustments.
3. Be concise. Use bullet points for recommendations.
4. If you do not have enough data to be sure, say so.
`;

      const chat = model.startChat({
        history: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
      });

      const result = await chat.sendMessage([
        { text: `[SYSTEM CONTEXT: ${systemPrompt}]` },
        { text: userMsg }
      ]);
      const response = await result.response;
      setMessages(prev => [...prev, { role: "model", text: response.text() }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: "model", text: "Error: Could not reach Gemini. Check your API key in Profile." }]);
    } finally {
      setLoading(false);
    }
  };

  const current = history[history.length - 1]?.posterior ?? seedPrior;

  return (
    <main className="container section" style={{ maxWidth: 720, paddingBottom: 120 }}>
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">Coach</span>
        <h1 className="h2" style={{ marginTop: 4 }}>Weekly check-in</h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>Accept weeks to lock in your adapted targets.</p>
      </header>

      <section className="glass-card glass-card-lg" style={{ marginBottom: 24 }}>
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
        <section className="glass-card" style={{ padding: 0, overflow: "hidden", marginBottom: 32 }}>
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

      {/* AI Coach Section */}
      <section className="glass-card glass-card-lg" style={{ background: "var(--surface-container-low)" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 0 }}>AI Coach</h3>
        {!geminiApiKey ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            Set your Gemini API key in <Link href="/profile" style={{ color: "var(--accent)" }}>Profile</Link> to chat with your AI coach.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: 14 }}>Ask anything about your progress, diet, or goals.</p>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", padding: "10px 14px", borderRadius: 16, background: m.role === "user" ? "var(--accent)" : "var(--surface)", color: m.role === "user" ? "#fff" : "var(--fg)", fontSize: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                  {m.text}
                </div>
              ))}
              {loading && <div style={{ fontSize: 12, color: "var(--muted)" }}>Coach is thinking...</div>}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input 
                type="text" 
                placeholder="How is my TDEE trending?" 
                value={input} 
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onChat()}
                style={{ flex: 1, padding: "12px 16px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 14, outline: 0 }}
              />
              <button onClick={onChat} disabled={loading || !input.trim()} style={{ width: 44, height: 44, borderRadius: 999, border: 0, background: "var(--accent)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: loading || !input.trim() ? 0.5 : 1 }}>
                →
              </button>
            </div>
          </div>
        )}
      </section>
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
