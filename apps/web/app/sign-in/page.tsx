"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isConfigured, supabase } from "@/lib/supabase";

/**
 * Email OTP sign-in (matches the mobile flow). Two phases: collect the
 * email and dispatch a code, then collect the 6-digit code and verify.
 * On success we redirect to /dashboard which is the live, per-user
 * variant of the console.
 */
export default function SignInPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isConfigured) {
    return (
      <main className="container section">
        <span className="eyebrow">System · Offline</span>
        <h1 className="h2" style={{ marginTop: 16 }}>BACKEND NOT CONFIGURED</h1>
        <p style={{ color: "var(--muted)", marginTop: 24 }}>
          Supabase env vars are missing. Set <code className="num">NEXT_PUBLIC_SUPABASE_URL</code>
          {" "}and <code className="num">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
          <code className="num">apps/web/.env.local</code>. See <code className="num">supabase/README.md</code>.
        </p>
      </main>
    );
  }

  const sendCode = async () => {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setPhase("code");
  };

  const verifyCode = async () => {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace("/dashboard");
  };

  return (
    <main className="container" style={{ maxWidth: 560, paddingBlock: "var(--gap-xl)" }}>
      <span className="eyebrow">System · Identity Handshake</span>
      <h1 className="h2" style={{ marginTop: 16, marginBottom: 24 }}>UPLINK</h1>

      <div className="card card-lg col" style={{ gap: "var(--gap-lg)" }}>
        {phase === "email" ? (
          <label className="col" style={{ gap: "var(--gap-sm)" }}>
            <span className="meta">Operator · Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              style={{
                fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700,
                background: "transparent", border: 0, borderBottom: "0.5px solid var(--border)",
                color: "var(--fg)", outline: "none", padding: "8px 0",
              }}
            />
          </label>
        ) : (
          <>
            <div className="col" style={{ gap: 4 }}>
              <span className="meta">Email Dispatched</span>
              <span className="num" style={{ fontSize: 16 }}>{email}</span>
            </div>
            <label className="col" style={{ gap: "var(--gap-sm)" }}>
              <span className="meta">6-Digit Code</span>
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 800,
                  background: "transparent", border: 0, borderBottom: "0.5px solid var(--border)",
                  color: "var(--fg)", outline: "none", padding: "8px 0", letterSpacing: "0.3em",
                }}
              />
            </label>
          </>
        )}
        {error && <span className="meta" style={{ color: "var(--accent)" }}>{error}</span>}
      </div>

      <div className="col" style={{ marginTop: "var(--gap-lg)", gap: "var(--gap-md)" }}>
        {phase === "email" ? (
          <button onClick={sendCode} disabled={busy || !email.includes("@")} style={btnPrimary}>
            {busy ? "Transmitting…" : "Transmit Code"}
          </button>
        ) : (
          <>
            <button onClick={verifyCode} disabled={busy || code.length !== 6} style={btnPrimary}>
              {busy ? "Verifying…" : "Verify Handshake"}
            </button>
            <button onClick={() => { setPhase("email"); setCode(""); }} style={btnSecondary}>
              Re-dispatch
            </button>
          </>
        )}
      </div>
    </main>
  );
}

const btnPrimary: React.CSSProperties = {
  background: "var(--accent)", color: "var(--bg)", border: "0.5px solid var(--accent)",
  padding: "16px 24px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
  letterSpacing: "0.18em", fontSize: 12, fontWeight: 700, borderRadius: 4, cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  background: "var(--surface)", color: "var(--fg)", border: "0.5px solid var(--border)",
  padding: "16px 24px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
  letterSpacing: "0.18em", fontSize: 12, fontWeight: 700, borderRadius: 4, cursor: "pointer",
};
