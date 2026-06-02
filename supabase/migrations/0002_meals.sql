-- ============================================================================
-- Phase 3: Food database + meal logging.
--
-- Replaces the flat `intake_logs` table with a richer model:
--   foods       — shared catalog (Open Food Facts cache + user-created entries)
--   meals       — one row per logged meal (breakfast/lunch/dinner/snack/quick)
--   meal_items  — line items within a meal, each with portion + macros
--
-- The engine still reads `intake_logs` (date, calories) — that name now
-- points at a VIEW (`v_daily_intake`) that aggregates meal_items. No engine
-- code changes; the repository just queries the view instead of the table.
-- ============================================================================

-- Destructive: drop the v1 intake_logs table. Pre-launch we have no
-- production data; if you've started logging, export first.
drop table if exists public.intake_logs cascade;

-- ---------------------------------------------------------------------------
-- foods — shared catalog
-- ---------------------------------------------------------------------------

create table public.foods (
  id                    uuid        primary key default gen_random_uuid(),
  source                text        not null check (source in ('off','usda','custom','quick_add')),
  -- Provider-side ID (e.g. Open Food Facts barcode, USDA fdc_id, or null
  -- for custom/quick_add). Unique per (source, source_ref) so a second
  -- cache attempt on the same OFF product just no-ops.
  source_ref            text,
  name                  text        not null,
  brand                 text,
  serving_size_g        numeric(7,2),
  kcal_per_100g         numeric(7,2) not null check (kcal_per_100g >= 0),
  protein_g_per_100g    numeric(6,2),
  carbs_g_per_100g      numeric(6,2),
  fat_g_per_100g        numeric(6,2),
  -- Human-friendly portion ("cup", "slice", "piece") + how many grams it
  -- weighs. Lets the UI offer "1 cup" instead of "240 g".
  common_unit           text,
  common_unit_grams     numeric(6,2),
  -- Optional ownership for custom foods (null for shared/cached entries).
  created_by            uuid        references auth.users(id) on delete set null,
  created_at            timestamptz not null default timezone('utc', now())
);
create unique index foods_source_ref_unique
  on public.foods (source, source_ref)
  where source_ref is not null;

-- pg_trgm gives us fuzzy substring search on food names. Supabase
-- installs extensions into the `extensions` schema by default, so we
-- both create the extension there and qualify the operator class
-- explicitly — otherwise the index DDL fails with
-- "operator class gin_trgm_ops does not exist".
create extension if not exists pg_trgm with schema extensions;
create index foods_name_trgm on public.foods using gin (name extensions.gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- meals — one row per eating event
-- ---------------------------------------------------------------------------

create table public.meals (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  date        date        not null,
  meal_type   text        not null check (meal_type in ('breakfast','lunch','dinner','snack','quick_add')),
  eaten_at    timestamptz,
  notes       text,
  created_at  timestamptz not null default timezone('utc', now())
);
create index meals_user_date on public.meals (user_id, date desc);

-- ---------------------------------------------------------------------------
-- meal_items — line items, optionally referencing a foods row
-- ---------------------------------------------------------------------------

create table public.meal_items (
  id          uuid        primary key default gen_random_uuid(),
  meal_id     uuid        not null references public.meals(id) on delete cascade,
  -- Nullable so "quick add" entries (just kcal + name) can exist without
  -- needing to fabricate a foods row.
  food_id     uuid        references public.foods(id) on delete set null,
  -- Denormalized name keeps history readable if the food is deleted or
  -- re-cached with a different name.
  name        text        not null,
  grams       numeric(7,2),
  kcal        integer     not null check (kcal >= 0),
  protein_g   numeric(6,2),
  carbs_g     numeric(6,2),
  fat_g       numeric(6,2),
  created_at  timestamptz not null default timezone('utc', now())
);
create index meal_items_meal on public.meal_items (meal_id);

-- ---------------------------------------------------------------------------
-- v_daily_intake — the engine's view of "calories per day per user".
-- security_invoker = on so RLS on the underlying tables is respected.
-- ---------------------------------------------------------------------------

create view public.v_daily_intake
with (security_invoker = on)
as
select
  m.user_id,
  m.date,
  coalesce(sum(mi.kcal),       0)::int           as calories,
  coalesce(sum(mi.protein_g),  0)::numeric(7,1)  as protein_g,
  coalesce(sum(mi.carbs_g),    0)::numeric(7,1)  as carbs_g,
  coalesce(sum(mi.fat_g),      0)::numeric(7,1)  as fat_g
from public.meals m
left join public.meal_items mi on mi.meal_id = m.id
group by m.user_id, m.date;

comment on view public.v_daily_intake is
  'Engine-facing daily intake totals. The historical intake_logs table was '
  'replaced in 0002_meals.sql by this view + the meals/meal_items tables.';

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.foods       enable row level security;
alter table public.meals       enable row level security;
alter table public.meal_items  enable row level security;

-- foods is a shared catalog: any signed-in user can read all rows, and
-- can insert new entries (cached OFF lookups + custom foods). Mutation
-- of someone else's row is denied; deletion limited to your own customs.
create policy foods_read_all on public.foods
  for select to authenticated using (true);
create policy foods_insert_signed_in on public.foods
  for insert to authenticated with check (true);
create policy foods_update_own on public.foods
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
create policy foods_delete_own on public.foods
  for delete to authenticated using (created_by = auth.uid());

create policy meals_owner on public.meals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- meal_items inherits ownership through its parent meal. We can't reference
-- another table in `using`, so we join via a subquery.
create policy meal_items_owner on public.meal_items
  for all to authenticated
  using (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()));
