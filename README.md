# Dynamic Energy Tracker

iOS-first dynamic TDEE tracker. Engine math is pure TypeScript; mobile is Expo / React Native; web is Next.js; backend is Supabase (Postgres + Auth). All three runtimes consume the same engine package.

Workspace layout:

```
.
├── packages/
│   ├── engine/         # pure TS — BMR, MET, weekly Bayesian TDEE, goal math
│   └── data/           # Supabase client + typed repositories + MFP importer
├── apps/
│   ├── mobile/         # Expo (SDK 52) iOS app
│   └── web/            # Next.js 15 — demo console, live dashboard, import
└── supabase/
    └── migrations/     # SQL schema + seed foods
```

---

## First-time setup

### 1. Supabase project (5 min)

1. Create a free project at <https://supabase.com>.
2. Settings → API → copy **Project URL** and **anon key**.
3. SQL Editor → run each migration in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_meals.sql`
   - `supabase/migrations/0003_account_actions.sql`
   - `supabase/migrations/0004_seed_foods.sql`
4. Authentication → Providers → confirm **Email** is enabled (default).
5. Authentication → URL Configuration → leave defaults (OTP code flow doesn't need redirect URLs).

### 2. Env vars (1 min)

Create two files (do not commit either):

```bash
# .env (workspace root — Expo reads this)
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

```bash
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Install (2 min)

```bash
npm install
```

### 4. Run the web app

```bash
npm run web
# open http://localhost:3000
```

### 5. Run the mobile app on your iPhone

Install [Expo Go](https://apps.apple.com/app/expo-go/id982107779) from the App Store.

```bash
npm run mobile
# scan the QR with the iPhone Camera app
```

All required deps are Expo Go compatible — no dev build needed for v1.

---

## Daily-use loop (what to test)

1. **Sign in** — same email on web + mobile. OTP code arrives in <30s.
2. **Onboard** (mobile only) — DOB picker, height, weight, goal. Timezone auto-detects from the device.
3. **Command** screen shows today's runway, BMR, current TDEE estimate, today's meals.
4. **Quick Log** tiles:
   - **Fuel** → /log-meal: search (cached → Open Food Facts), pick portion, commit
   - **Mass** → /log-mass: enter weight, see Δ vs last
   - **Activity** → /log-activity: pick MET activity, enter duration, commit
5. **Convergence** — run the weekly audit; "Accept" persists to `engine_state_weekly`.
6. **Settings** — view profile, export JSON, sign out, purge account.
7. **Web** — `/dashboard` mirrors today's state; `/import` ingests MFP CSV; `/log-meal` works in the browser too.

---

## Common scripts

```bash
npm test               # all workspace tests
npm run typecheck      # tsc --noEmit across packages + apps
npm run web            # next dev on apps/web
npm run mobile         # expo start on apps/mobile
npm run ios            # expo start --ios
```

---

## Known limits / dev-build territory

These need an Expo Dev Build (EAS) rather than Expo Go and were skipped for v1:

- HealthKit live sync (weight + steps + workouts)
- Barcode scanner (the food logger's "Scan" path)
- iOS push notifications (Monday check-in reminders)

Everything in the daily loop above works in Expo Go.
