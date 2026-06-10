"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStore } from "@/lib/local-store";

export default function RootPage() {
  const router = useRouter();
  const hasProfile = useLocalStore((s) => s.profile !== null);

  useEffect(() => {
    router.replace(hasProfile ? "/today" : "/onboarding");
  }, [hasProfile, router]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.4 }}>Loading…</span>
    </main>
  );
}
