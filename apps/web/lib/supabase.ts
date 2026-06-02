"use client";

import { createDataClient, repositories, type Repositories } from "@dynamic-energy/data";

/**
 * Browser-side singleton. Web stores the session in localStorage via
 * supabase-js's default storage. `"use client"` ensures this module is
 * never bundled into a server component graph (which would error on
 * `localStorage`).
 *
 * If env vars are missing we still construct a client against `''` —
 * any request will fail fast with a clear error, and the homepage's
 * seed view (which never hits supabase) keeps working for demo
 * purposes.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isConfigured = url.length > 0 && anonKey.length > 0;

export const supabase = createDataClient({
  url: url || "https://invalid.local",
  anonKey: anonKey || "invalid",
});

export const repos: Repositories = repositories(supabase);
