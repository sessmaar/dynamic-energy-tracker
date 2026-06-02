-- ============================================================================
-- Phase 5: Recipes + macro targets.
--
--   * recipes / recipe_items — a saved combination of foods the user
--     can drop into a meal as a single click. Recipes are owned (RLS by
--     user_id); rolling them out as a sharable catalog is a future move.
--
--   * goals table gains three nullable target columns: protein_g_target,
--     carbs_g_target, fat_g_target. Targets are stored as absolute
--     grams/day — the UI computes them from the user's chosen ratio at
--     goal-set time, but persisting absolute values keeps the engine
--     read-side simple (no recomputation based on weight).
-- ============================================================================

create table public.recipes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  notes       text,
  created_at  timestamptz not null default timezone('utc', now())
);
create index recipes_user on public.recipes (user_id, created_at desc);

create table public.recipe_items (
  id          uuid        primary key default gen_random_uuid(),
  recipe_id   uuid        not null references public.recipes(id) on delete cascade,
  food_id     uuid        references public.foods(id) on delete set null,
  -- Same denormalization story as meal_items: history survives food edits.
  name        text        not null,
  grams       numeric(7,2),
  kcal        integer     not null check (kcal >= 0),
  protein_g   numeric(6,2),
  carbs_g     numeric(6,2),
  fat_g       numeric(6,2),
  created_at  timestamptz not null default timezone('utc', now())
);
create index recipe_items_recipe on public.recipe_items (recipe_id);

alter table public.recipes      enable row level security;
alter table public.recipe_items enable row level security;

create policy recipes_owner on public.recipes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy recipe_items_owner on public.recipe_items
  for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- Macro targets on goals
-- ----------------------------------------------------------------------------

alter table public.goals
  add column protein_g_target integer check (protein_g_target is null or protein_g_target >= 0),
  add column carbs_g_target   integer check (carbs_g_target   is null or carbs_g_target   >= 0),
  add column fat_g_target     integer check (fat_g_target     is null or fat_g_target     >= 0);

comment on column public.goals.protein_g_target is
  'Daily protein target in grams. Nullable — UI hides macro progress when unset.';
