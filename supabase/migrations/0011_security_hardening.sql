-- ============================================================================
-- 0011: Security hardening pass.
--
-- Fixes four Supabase advisor findings:
--   1. set_updated_at had a mutable search_path (search_path injection risk)
--   2. handle_new_user and rls_auto_enable were publicly callable via REST API
--   3. auth.uid() re-evaluated per-row in RLS policies (performance + best practice)
--   4. Missing FK covering indexes on foods.created_by and meal_items.food_id
-- ============================================================================

-- 1. Fix set_updated_at: pin search_path to prevent search_path injection
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- 2. Revoke public execute on SECURITY DEFINER trigger functions.
--    handle_new_user is only meant to fire as a trigger, not be called directly.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- rls_auto_enable is an internal utility — revoke if it exists.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from anon, authenticated';
  end if;
end
$$;

-- 3. Fix RLS auth() re-evaluation: replace auth.uid() with (select auth.uid())
--    so the uid is computed once per statement rather than once per row.

-- profiles
drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- goals
drop policy if exists goals_owner on public.goals;
create policy goals_owner on public.goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- weight_entries
drop policy if exists weight_entries_owner on public.weight_entries;
create policy weight_entries_owner on public.weight_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- activity_blocks
drop policy if exists activity_blocks_owner on public.activity_blocks;
create policy activity_blocks_owner on public.activity_blocks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- engine_state_weekly
drop policy if exists engine_state_weekly_owner on public.engine_state_weekly;
create policy engine_state_weekly_owner on public.engine_state_weekly
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- daily_targets
drop policy if exists daily_targets_owner on public.daily_targets;
create policy daily_targets_owner on public.daily_targets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- meals
drop policy if exists meals_owner on public.meals;
create policy meals_owner on public.meals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- foods: update/delete own-created rows
drop policy if exists foods_update_own on public.foods;
create policy foods_update_own on public.foods
  for update to authenticated
  using (created_by = (select auth.uid()));

drop policy if exists foods_delete_own on public.foods;
create policy foods_delete_own on public.foods
  for delete to authenticated
  using (created_by = (select auth.uid()));

-- 4. Add missing FK covering indexes
create index if not exists foods_created_by_idx on public.foods (created_by);
create index if not exists meal_items_food_id_idx on public.meal_items (food_id);
