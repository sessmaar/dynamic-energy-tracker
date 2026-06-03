"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isConfigured, supabase } from "@/lib/supabase";

type Phase = "select" | "email_otp" | "otp_code" | "password" | "verifying";

export default function SignInPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("select");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
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

  const loginWithGoogle = async () => {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
  };

  const sendCode = async () => {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      setPhase("otp_code");
    }
  };

  const verifyCode = async () => {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace("/dashboard");
  };

  const loginWithPassword = async () => {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace("/dashboard");
  };

  return (
    <main className="container" style={{ maxWidth: 560, paddingBlock: "var(--gap-xl)" }}>
      <span className="eyebrow">Welcome Back</span>
      <h1 className="h2" style={{ marginTop: 16, marginBottom: 24 }}>SIGN IN</h1>

      <div className="card card-lg col" style={{ gap: "var(--gap-lg)" }}>
        {phase === "select" && (
          <div className="col" style={{ gap: "var(--gap-md)" }}>
            <button onClick={loginWithGoogle} style={btnPrimary}>
              Continue with Google
            </button>
            <button onClick={() => { setError(null); setPhase("email_otp"); }} style={btnSecondary}>
              Use Verification Code
            </button>
            <button onClick={() => { setError(null); setPhase("password"); }} style={btnSecondary}>
              Use Email & Password
            </button>
          </div>
        )}

        {(phase === "email_otp" || phase === "password" || phase === "otp_code") && (
          <div className="col" style={{ gap: "var(--gap-lg)" }}>
            {phase === "email_otp" && (
              <label className="col" style={{ gap: "var(--gap-sm)" }}>
                <span className="meta">Email Address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  style={inputStyle}
                />
              </label>
            )}

            {phase === "password" && (
              <>
                <label className="col" style={{ gap: "var(--gap-sm)" }}>
                  <span className="meta">Email Address</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    style={inputStyle}
                  />
                </label>
                <label className="col" style={{ gap: "var(--gap-sm)" }}>
                  <span className="meta">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                  />
                </label>
              </>
            )}

            {phase === "otp_code" && (
              <>
                <div className="col" style={{ gap: 4 }}>
                  <span className="meta">Verification Email Sent</span>
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
                      ...inputStyle,
                      fontSize: 32,
                      fontWeight: 800,
                      letterSpacing: "0.3em",
                    }}
                  />
                </label>
              </>
            )}

            {error && <span className="meta" style={{ color: "var(--accent)" }}>{error}</span>}
          </div>
        )}
      </div>

      {phase !== "select" && (
        <div className="col" style={{ marginTop: "var(--gap-lg)", gap: "var(--gap-md)" }}>
          {phase === "email_otp" && (
            <>
              <button onClick={sendCode} disabled={busy || !email.includes("@")} style={btnPrimary}>
                {busy ? "Sending Code…" : "Send Verification Code"}
              </button>
              <button onClick={() => setPhase("select")} style={btnSecondary}>
                Back to Options
              </button>
            </>
          )}

          {phase === "password" && (
            <>
              <button onClick={loginWithPassword} disabled={busy || !email || !password} style={btnPrimary}>
                {busy ? "Signing In…" : "Sign In"}
              </button>
              <button onClick={() => setPhase("select")} style={btnSecondary}>
                Back to Options
              </button>
            </>
          )}

          {phase === "otp_code" && (
            <>
              <button onClick={verifyCode} disabled={busy || code.length !== 6} style={btnPrimary}>
                {busy ? "Verifying…" : "Verify Code"}
              </button>
              <button onClick={sendCode} disabled={busy} style={btnSecondary}>
                Resend Email
              </button>
              <button onClick={() => { setPhase("select"); setCode(""); }} style={btnSecondary}>
                Back to Options
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 22,
  fontWeight: 700,
  background: "transparent",
  border: 0,
  borderBottom: "0.5px solid var(--border)",
  color: "var(--fg)",
  outline: "none",
  padding: "8px 0",
};

const btnPrimary: React.CSSProperties = {
  background: "var(--accent)", color: "var(--bg)", border: "0.5px solid var(--accent)",
  padding: "16px 24px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
  letterSpacing: "0.18em", fontSize: 12, fontWeight: 700, borderRadius: 4, cursor: "pointer",
  width: "100%", textAlign: "center",
};
const btnSecondary: React.CSSProperties = {
  background: "var(--surface)", color: "var(--fg)", border: "0.5px solid var(--border)",
  padding: "16px 24px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
  letterSpacing: "0.18em", fontSize: 12, fontWeight: 700, borderRadius: 4, cursor: "pointer",
  width: "100%", textAlign: "center",
};
