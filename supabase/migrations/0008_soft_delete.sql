-- ============================================================================
-- 0008_soft_delete — preserve user history on deletion
-- ============================================================================
-- Adds `deleted_at` to all user-owned data tables and updates RLS policies
-- to automatically filter out soft-deleted rows. This prevents accidental
-- data loss and provides a "trash" window before permanent purging.

-- 1. Add column to all user-owned tables
alter table public.profiles           add column deleted_at timestamptz;
alter table public.goals              add column deleted_at timestamptz;
alter table public.weight_entries     add column deleted_at timestamptz;
alter table public.activity_blocks    add column deleted_at timestamptz;
alter table public.meals              add column deleted_at timestamptz;
alter table public.meal_items         add column deleted_at timestamptz;
alter table public.recipes            add column deleted_at timestamptz;
alter table public.recipe_items       add column deleted_at timestamptz;
alter table public.body_measurements  add column deleted_at timestamptz;
alter table public.progress_photos    add column deleted_at timestamptz;

-- 2. Update v_daily_intake to exclude soft-deleted meals
create or replace view public.v_daily_intake
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
where m.deleted_at is null and mi.deleted_at is null
group by m.user_id, m.date;

-- 3. Update RLS policies to filter by deleted_at is null
-- Note: We drop and recreate policies that use the 'owner' pattern.

-- Profiles
drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all to authenticated
  using (id = auth.uid() and deleted_at is null)
  with check (id = auth.uid());

-- Goals
drop policy if exists goals_owner on public.goals;
create policy goals_owner on public.goals
  for all to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

-- Weight Entries
drop policy if exists weight_entries_owner on public.weight_entries;
create policy weight_entries_owner on public.weight_entries
  for all to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

-- Activity Blocks
drop policy if exists activity_blocks_owner on public.activity_blocks;
create policy activity_blocks_owner on public.activity_blocks
  for all to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

-- Meals
drop policy if exists meals_owner on public.meals;
create policy meals_owner on public.meals
  for all to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

-- Meal Items (inherits via parent meal)
drop policy if exists meal_items_owner on public.meal_items;
create policy meal_items_owner on public.meal_items
  for all to authenticated
  using (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid() and m.deleted_at is null) and deleted_at is null)
  with check (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid() and m.deleted_at is null));

-- Recipes
drop policy if exists recipes_owner on public.recipes;
create policy recipes_owner on public.recipes
  for all to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

-- Recipe Items
drop policy if exists recipe_items_owner on public.recipe_items;
create policy recipe_items_owner on public.recipe_items
  for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid() and r.deleted_at is null) and deleted_at is null)
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid() and r.deleted_at is null));

-- Body Measurements
drop policy if exists body_measurements_owner on public.body_measurements;
create policy body_measurements_owner on public.body_measurements
  for all to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

-- Progress Photos
drop policy if exists progress_photos_owner on public.progress_photos;
create policy progress_photos_owner on public.progress_photos
  for all to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());
