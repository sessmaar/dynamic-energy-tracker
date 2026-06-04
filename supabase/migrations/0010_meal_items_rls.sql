-- ============================================================================
-- 0010: Add RLS policies for meal_items.
--
-- meal_items had RLS enabled but no policies, blocking all reads and writes.
-- Ownership is indirect: meal_items.meal_id → meals.user_id.
-- Using (select auth.uid()) avoids per-row re-evaluation of the auth function.
-- ============================================================================

create policy meal_items_select on public.meal_items
  for select to authenticated
  using (
    exists (
      select 1 from public.meals
      where id = meal_items.meal_id
        and user_id = (select auth.uid())
    )
  );

create policy meal_items_insert on public.meal_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.meals
      where id = meal_items.meal_id
        and user_id = (select auth.uid())
    )
  );

create policy meal_items_update on public.meal_items
  for update to authenticated
  using (
    exists (
      select 1 from public.meals
      where id = meal_items.meal_id
        and user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.meals
      where id = meal_items.meal_id
        and user_id = (select auth.uid())
    )
  );

create policy meal_items_delete on public.meal_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.meals
      where id = meal_items.meal_id
        and user_id = (select auth.uid())
    )
  );
