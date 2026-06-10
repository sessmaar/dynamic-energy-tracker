"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string }[] = [
  { href: "/today", label: "Today" },
  { href: "/log-meal", label: "Log food" },
  { href: "/dashboard", label: "Trends" },
  { href: "/convergence", label: "Coach" },
  { href: "/profile", label: "Profile" },
];

const HIDE_ON = ["/", "/onboarding"];

export const TabBar = () => {
  const pathname = usePathname() || "/";
  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "var(--surface)", borderTop: "1px solid var(--border)",
      display: "grid", gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} style={{
            padding: "10px 4px 12px", textAlign: "center",
            color: active ? "var(--accent)" : "var(--muted)",
            fontSize: 11, fontWeight: 600, textDecoration: "none",
          }}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
};
