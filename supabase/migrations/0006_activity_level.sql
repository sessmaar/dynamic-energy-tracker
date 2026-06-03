-- ---------------------------------------------------------------------------
-- 0006_activity_level — lifestyle factor for the cold-start TDEE prior
-- ---------------------------------------------------------------------------
-- Onboarding now asks one lifestyle question and maps it to a Physical
-- Activity Level (PAL) multiplier (Harris–Benedict / FAO-WHO-UNU). The
-- engine uses BMR × PAL to seed the Bayesian TDEE estimate before any
-- weeks of logs exist. Existing rows default to 'moderate' (1.55), which
-- is the closest tier to the previous blanket 1.4 seed.

alter table public.profiles
  add column activity_level text not null default 'moderate'
    check (activity_level in ('sedentary', 'light', 'moderate', 'very', 'extra'));
