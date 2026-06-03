# Testing Readiness Checklist

Work through this top-to-bottom before your first real test session.
Check off each item as you complete it.

---

## 1 · Vercel

- [ ] Latest `main` deployment status is **Ready** (not Error)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set for **Production** and **Preview**
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set for **Production** and **Preview**
- [ ] `NEXT_PUBLIC_SITE_URL` is set to your production URL (e.g. `https://dynamic-energy-tracker-web.vercel.app`)
- [ ] GitHub CI badge is green on `main`

---

## 2 · Supabase — Auth Configuration

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. Set **Site URL** to your Vercel production URL:
   ```
   https://dynamic-energy-tracker-web.vercel.app
   ```
3. Add these to **Additional Redirect URLs**:
   ```
   http://localhost:3000/**
   https://dynamic-energy-tracker-web.vercel.app/**
   https://*-sessmaars-projects.vercel.app/**
   ```

- [ ] Site URL set
- [ ] Redirect URLs added

---

## 3 · Supabase — Google OAuth

1. Go to **Supabase → Authentication → Providers → Google**
2. Enable Google provider
3. Paste your Google OAuth Client ID and Secret
   - Get these from [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
   - In Google Cloud, add this as an authorized redirect URI:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`

- [ ] Google provider enabled
- [ ] Client ID + Secret added
- [ ] Google Cloud redirect URI set

---

## 4 · Supabase — RLS Policies

Go to **Supabase → Table Editor** and verify these tables exist:
- `profiles`
- `goals`
- `weight_entries`

For each table, go to **Authentication → Policies** and confirm:
- Authenticated users can `INSERT` their own rows (`auth.uid() = user_id`)
- Authenticated users can `UPDATE` their own rows
- Authenticated users can `SELECT` their own rows

- [ ] `profiles` — insert/update/select policies exist
- [ ] `goals` — insert/update/select policies exist
- [ ] `weight_entries` — insert/select policies exist

---

## 5 · Core Route Smoke Test (Desktop Browser)

Open your production URL in Chrome or Firefox:

- [ ] `/dashboard` while logged out → redirects to `/sign-in`
- [ ] `/log-meal` while logged out → redirects to `/sign-in`
- [ ] Sign in with Google or OTP
- [ ] `/onboard` completes without error
- [ ] `/dashboard` loads after onboarding
- [ ] Refresh `/dashboard` → stays on dashboard (session persists)
- [ ] Sign out → protected routes redirect again

---

## 6 · iPhone PWA Install Test

1. Open production URL in **Safari on iPhone**
2. Sign in and complete onboarding
3. Tap **Share → Add to Home Screen**
4. Launch from home screen

- [ ] App opens in standalone mode (no Safari chrome)
- [ ] Session persists after launch from home screen
- [ ] Dashboard loads
- [ ] Log Meal route works
- [ ] Long-press icon → quick actions appear (Log Meal, Dashboard)

---

## 7 · GitHub CI

- [ ] `.github/workflows/ci.yml` passes on `main`
- [ ] Branch protection enabled on `main` (Settings → Branches → Add rule → Require status checks)

---

## Ready to Test ✓

When all boxes above are checked, you are clear to start your first test session.
