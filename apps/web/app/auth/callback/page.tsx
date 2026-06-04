"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Client-side OAuth callback handler.
 *
 * The server-side Route Handler approach didn't work because supabase-js
 * stores sessions in localStorage (browser only). Code exchange must happen
 * in the browser so the session is available to subsequent page loads.
 *
 * Supabase redirects here with ?code=<pkce_code>&next=<destination>.
 * We call exchangeCodeForSession in the browser, which writes the session
 * to localStorage, then navigate to the destination.
 */
function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";

    if (!code) {
      router.replace(next);
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        router.replace(`/sign-in?error=oauth_callback_failed`);
      } else {
        router.replace(next);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        background: "var(--bg)",
        color: "var(--muted)",
      }}
    >
      <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.15em" }}>
        Completing sign-in…
      </span>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            background: "var(--bg)",
            color: "var(--muted)",
          }}
        >
          <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.15em" }}>
            Loading…
          </span>
        </main>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
