# Supabase backend

This directory holds the schema and seed data for Dynamic Energy Tracker's backend.
The mobile and web apps both read/write through the typed client in
[`packages/data`](../packages/data).

## Quickstart (hosted Supabase)

1. Create a new project at https://supabase.com → "New project".
2. Get the project URL and `anon` key from **Project Settings → API**.
3. Copy them into the root `.env`:
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
4. Run the migration in the **SQL Editor**:
   - Paste the contents of `migrations/0001_init.sql` and execute.
5. Enable **Email auth** under **Authentication → Providers** (magic link is the
   default — the mobile/web flows expect it).

## Quickstart (local Supabase with the CLI)

1. `brew install supabase/tap/supabase`
2. From the repo root: `supabase init && supabase start`
3. The CLI prints local URL + anon key — paste into `.env`.
4. `supabase db reset` runs `migrations/*.sql` in order.

## Schema overview

| Table                  | Purpose                                                       |
|------------------------|---------------------------------------------------------------|
| `profiles`             | One row per auth user; sex, DOB, height, starting weight      |
| `goals`                | Active goal (kg/week target). One active per user (enforced)  |
| `weight_entries`       | Raw scale readings. Trend is computed by the engine, not stored |
| `intake_logs`          | One row per user per day (v1 is daily totals)                 |
| `activity_blocks`      | Posture + workout blocks with stored MET value                |
| `engine_state_weekly`  | Bayesian audit log — one row per Monday window                |
| `daily_targets`        | Engine output — base + activity-credited daily target         |

Every table has **Row Level Security** enabled with a single policy: a row is
visible/mutable only when `user_id = auth.uid()` (or `id = auth.uid()` for
`profiles`). The `anon` role has no access; only `authenticated` does.

## Notes

- Units are kg / cm / kcal everywhere — same as the engine package, so the
  repository layer only brands values, never converts.
- `intake_logs (user_id, date)` is unique, so use upsert (`on conflict do update`)
  for daily intake writes.
- `engine_state_weekly (user_id, week_start_date)` is also unique. The Monday
  check-in flow upserts, overwriting prior estimates if the same week is
  recomputed (e.g. after the user backfills a missed day).
