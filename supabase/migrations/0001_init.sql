-- ============================================================================
-- Dynamic Energy Tracker — initial schema
--
-- Mirrors the conceptual data model in the PRD. Every user-owned table has
-- RLS enabled with a single policy: a row is visible/mutable only to the
-- user whose auth.uid() matches its user_id. Mass is stored in kg, energy
-- in kcal — same units the engine uses, so the repository layer only has
-- to brand the values, not convert them.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user; created on first sign-in by a trigger
-- ---------------------------------------------------------------------------

create table public.profiles (
  id              uuid        primary key references auth.users(id) on delete cascade,
  sex             text        not null check (sex in ('male', 'female')),
  date_of_birth   date        not null,
  height_cm       numeric(5,1) not null check (height_cm > 0),
  initial_weight_kg numeric(5,2) not null check (initial_weight_kg > 0),
  timezone        text        not null default 'UTC',
  preferred_units text        not null default 'metric' check (preferred_units in ('metric','imperial')),
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- goals — at most one active goal per user (enforced by partial unique index)
-- ---------------------------------------------------------------------------

create table public.goals (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users(id) on delete cascade,
  goal_type            text        not null check (goal_type in ('cut','maintain','gain')),
  goal_rate_kg_per_week numeric(4,2) not null,
  start_date           date        not null,
  end_date             date,
  status               text        not null default 'active' check (status in ('active','paused','completed')),
  created_at           timestamptz not null default timezone('utc', now())
);
create unique index goals_one_active_per_user on public.goals (user_id) where status = 'active';
create index goals_user_id on public.goals (user_id);

-- ---------------------------------------------------------------------------
-- weight_entries — many per day allowed (e.g. AM/PM); trend handled in engine
-- ---------------------------------------------------------------------------

create table public.weight_entries (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  date        date        not null,
  weight_kg   numeric(5,2) not null check (weight_kg > 0),
  source      text        not null default 'manual' check (source in ('manual','healthkit','import')),
  note        text,
  created_at  timestamptz not null default timezone('utc', now())
);
create index weight_entries_user_date on public.weight_entries (user_id, date desc);

-- ---------------------------------------------------------------------------
-- intake_logs — v1 is daily totals (one row per user per day)
-- ---------------------------------------------------------------------------

create table public.intake_logs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  date       date        not null,
  calories   integer     not null check (calories >= 0),
  protein_g  numeric(6,1),
  carbs_g    numeric(6,1),
  fat_g      numeric(6,1),
  notes      text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, date)
);
create trigger intake_logs_set_updated_at before update on public.intake_logs
  for each row execute function public.set_updated_at();
create index intake_logs_user_date on public.intake_logs (user_id, date desc);

-- ---------------------------------------------------------------------------
-- activity_blocks — fine-grained posture + workout log
-- ---------------------------------------------------------------------------

create table public.activity_blocks (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  date            date        not null,
  start_at        timestamptz,
  end_at          timestamptz,
  activity_type   text        not null,
  intensity       text,
  duration_min    integer     not null check (duration_min > 0),
  met_value       numeric(4,2) not null check (met_value > 0),
  calories_active integer     not null check (calories_active >= 0),
  created_at      timestamptz not null default timezone('utc', now())
);
create index activity_blocks_user_date on public.activity_blocks (user_id, date desc);

-- ---------------------------------------------------------------------------
-- engine_state_weekly — Bayesian audit log; one row per Monday per user
-- ---------------------------------------------------------------------------

create table public.engine_state_weekly (
  id                       uuid        primary key default gen_random_uuid(),
  user_id                  uuid        not null references auth.users(id) on delete cascade,
  week_start_date          date        not null,
  tdee_prior               numeric(6,1) not null,
  tdee_week_estimate       numeric(6,1) not null,
  tdee_posterior           numeric(6,1) not null,
  alpha                    numeric(3,2) not null,
  data_completeness_score  numeric(3,2) not null,
  avg_intake               numeric(6,1) not null,
  delta_weight_kg          numeric(5,3) not null,
  accepted                 boolean     not null default false,
  created_at               timestamptz not null default timezone('utc', now()),
  unique (user_id, week_start_date)
);
create index engine_state_weekly_user on public.engine_state_weekly (user_id, week_start_date desc);

-- ---------------------------------------------------------------------------
-- daily_targets — engine output, one row per user per day
-- ---------------------------------------------------------------------------

create table public.daily_targets (
  id                        uuid        primary key default gen_random_uuid(),
  user_id                   uuid        not null references auth.users(id) on delete cascade,
  date                      date        not null,
  target_calories_base      integer     not null check (target_calories_base >= 0),
  target_calories_adjusted  integer,
  planned_training_flag     boolean     not null default false,
  created_at                timestamptz not null default timezone('utc', now()),
  unique (user_id, date)
);
create index daily_targets_user_date on public.daily_targets (user_id, date desc);

-- ---------------------------------------------------------------------------
-- Auto-bootstrap: when a new auth user is created, leave profile blank — the
-- onboarding flow inserts it. We intentionally do NOT auto-insert a stub
-- profile, because the engine needs real height/weight to seed BMR.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.goals               enable row level security;
alter table public.weight_entries      enable row level security;
alter table public.intake_logs         enable row level security;
alter table public.activity_blocks     enable row level security;
alter table public.engine_state_weekly enable row level security;
alter table public.daily_targets       enable row level security;

-- Each table: a user can only see and mutate rows where id (profiles) or
-- user_id matches their auth.uid(). One policy per table covering all verbs.

create policy profiles_owner on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy goals_owner on public.goals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy weight_entries_owner on public.weight_entries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy intake_logs_owner on public.intake_logs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy activity_blocks_owner on public.activity_blocks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy engine_state_weekly_owner on public.engine_state_weekly
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy daily_targets_owner on public.daily_targets
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
