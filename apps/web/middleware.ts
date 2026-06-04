import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight session guard that runs on the Edge runtime.
 *
 * Supabase-js stores the session as a cookie named
 * `sb-<project-ref>-auth-token` (or the legacy `supabase-auth-token`).
 * We do a simple presence check — the real token validation happens
 * inside the API routes / server components that call supabase directly.
 *
 * Protected routes: /dashboard, /log-meal, /import
 * Auth routes: /sign-in (redirect to /dashboard if already logged in)
 */

const PROTECTED = ["/dashboard", "/log-meal", "/import", "/onboard", "/log-weight", "/convergence"];
const AUTH_ROUTES = ["/sign-in"];

function hasSession(request: NextRequest): boolean {
  const cookies = request.cookies;
  // Supabase v2 cookie names start with `sb-` and end with `-auth-token`
  for (const [name] of cookies) {
    if (name.startsWith("sb-") && name.endsWith("-auth-token")) return true;
  }
  // Legacy fallback
  if (cookies.has("supabase-auth-token")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = hasSession(request);

  // Redirect authenticated users away from sign-in
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r)) && loggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users away from protected routes
  if (PROTECTED.some((r) => pathname.startsWith(r)) && !loggedIn) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/log-meal/:path*",
    "/import/:path*",
    "/onboard/:path*",
    "/log-weight/:path*",
    "/convergence/:path*",
    "/sign-in/:path*",
    "/sign-in",
  ],
};
