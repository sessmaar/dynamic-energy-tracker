"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { isConfigured, supabase } from "@/lib/supabase";

type Phase = "select" | "email_otp" | "otp_code" | "password";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const [phase, setPhase] = useState<Phase>("select");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    oauthError === "oauth_callback_failed" ? "Google sign-in failed. Please try again." : null
  );
  const [busy, setBusy] = useState(false);

  const loginWithGoogle = async () => {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace("/dashboard");
  };

  return (
    <div className="w-full max-w-[420px] space-y-6">
      <div className="text-center space-y-2">
        <span className="eyebrow text-xs">Identity Verification</span>
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome Back</h1>
      </div>

      <div className="glass-card glass-card-lg space-y-6 shadow-md">
        {phase === "select" && (
          <div className="col" style={{ gap: "var(--gap-md)" }}>
            <button onClick={loginWithGoogle} disabled={busy} style={btnPrimary}>
              {busy ? "Redirecting…" : "Continue with Google"}
            </button>
            <button onClick={() => { setError(null); setPhase("email_otp"); }} style={btnSecondary}>
              Verification Code
            </button>
            <button onClick={() => { setError(null); setPhase("password"); }} style={btnSecondary}>
              Email & Password
            </button>
          </div>
        )}

        {(phase === "email_otp" || phase === "password" || phase === "otp_code") && (
          <div className="col" style={{ gap: "var(--gap-lg)" }}>
            {phase === "email_otp" && (
              <div className="col" style={{ gap: "var(--gap-sm)" }}>
                <span className="meta text-xs">Email Address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="input-minimal"
                  placeholder="name@domain.com"
                />
              </div>
            )}

            {phase === "password" && (
              <>
                <div className="col" style={{ gap: "var(--gap-sm)" }}>
                  <span className="meta text-xs">Email Address</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    className="input-minimal"
                    placeholder="name@domain.com"
                  />
                </div>
                <div className="col" style={{ gap: "var(--gap-sm)" }}>
                  <span className="meta text-xs">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-minimal"
                    placeholder="••••••••"
                  />
                </div>
              </>
            )}

            {phase === "otp_code" && (
              <>
                <div className="col" style={{ gap: 4 }}>
                  <span className="meta text-xs">Code Sent To</span>
                  <span className="num font-semibold text-fg text-sm">{email}</span>
                </div>
                <div className="col" style={{ gap: "var(--gap-sm)" }}>
                  <span className="meta text-xs">6-Digit Code</span>
                  <input
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoFocus
                    className="input-minimal"
                    style={{ fontSize: 32, fontWeight: 700, letterSpacing: "0.2em", textAlign: "center" }}
                  />
                </div>
              </>
            )}

            {error && (
              <span className="meta text-xs" style={{ color: "var(--error)", textTransform: "none" }}>
                {error}
              </span>
            )}
          </div>
        )}
      </div>

      {phase !== "select" && (
        <div className="col" style={{ gap: "var(--gap-md)" }}>
          {phase === "email_otp" && (
            <>
              <button onClick={sendCode} disabled={busy || !email.includes("@")} style={btnPrimary}>
                {busy ? "Sending Code…" : "Send Verification Code"}
              </button>
              <button onClick={() => setPhase("select")} style={btnSecondary}>Cancel</button>
            </>
          )}
          {phase === "password" && (
            <>
              <button onClick={loginWithPassword} disabled={busy || !email || !password} style={btnPrimary}>
                {busy ? "Signing In…" : "Sign In"}
              </button>
              <button onClick={() => setPhase("select")} style={btnSecondary}>Cancel</button>
            </>
          )}
          {phase === "otp_code" && (
            <>
              <button onClick={verifyCode} disabled={busy || code.length !== 6} style={btnPrimary}>
                {busy ? "Verifying…" : "Verify Code"}
              </button>
              <button onClick={sendCode} disabled={busy} style={btnSecondary}>Resend Code</button>
              <button onClick={() => { setPhase("select"); setCode(""); }} style={btnSecondary}>Cancel</button>
            </>
          )}
        </div>
      )}

      {phase === "select" && error && (
        <span className="meta text-xs" style={{ color: "var(--error)", textTransform: "none", textAlign: "center", display: "block" }}>
          {error}
        </span>
      )}
    </div>
  );
}

export default function SignInPage() {
  if (!isConfigured) {
    return (
      <main className="container section">
        <span className="eyebrow">System · Offline</span>
        <h1 className="h2" style={{ marginTop: 16 }}>BACKEND NOT CONFIGURED</h1>
        <p style={{ color: "var(--muted)", marginTop: 24 }}>
          Supabase env vars are missing. Set <code className="num">NEXT_PUBLIC_SUPABASE_URL</code>
          {" "}and <code className="num">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
          <code className="num">apps/web/.env.local</code>.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg font-body-md antialiased hero-gradient flex flex-col justify-between">
      <nav className="p-6">
        <Link href="/" className="font-display font-bold text-lg tracking-tight text-fg">
          Dense Matrix
        </Link>
      </nav>
      <main className="container flex-1 flex flex-col items-center justify-center p-6">
        <Suspense fallback={
          <div className="w-full max-w-[420px] text-center">
            <span className="meta text-xs text-muted">Loading…</span>
          </div>
        }>
          <SignInForm />
        </Suspense>
      </main>
      <footer className="p-6 text-center">
        <span className="meta text-[10px] text-muted">Secured with Supabase Auth</span>
      </footer>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "#ffffff",
  border: 0,
  padding: "14px 20px",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 600,
  borderRadius: "999px",
  cursor: "pointer",
  width: "100%",
  textAlign: "center",
  boxShadow: "0px 4px 12px rgba(0, 88, 188, 0.15)",
  transition: "opacity 0.15s ease",
};

const btnSecondary: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.6)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  padding: "14px 20px",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 500,
  borderRadius: "999px",
  cursor: "pointer",
  width: "100%",
  textAlign: "center",
  transition: "background-color 0.15s ease",
};
