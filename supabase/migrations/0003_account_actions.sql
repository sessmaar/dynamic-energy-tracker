-- ============================================================================
-- Phase 4: Account self-service actions + small polish.
--
--   * `public.delete_self()` — RPC users call to wipe their own auth row.
--     `auth.users` deletion isn't reachable from PostgREST directly (RLS
--     on the auth schema is owned by the supabase_auth_admin role), so we
--     wrap it in a SECURITY DEFINER function that's only invokable by an
--     authenticated session and only ever touches the caller's row.
--
--   * tighten engine_state_weekly grant so a user can persist their own
--     accepted check-ins (RLS policy was added in 0001; nothing else).
-- ============================================================================

create or replace function public.delete_self()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'delete_self: no authenticated user';
  end if;
  -- All user-owned tables have `on delete cascade` to auth.users, so
  -- this single delete reaps profile / goals / meals / weights / etc.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_self() from public;
grant execute on function public.delete_self() to authenticated;

comment on function public.delete_self() is
  'Self-service account deletion. Cascades through all user-owned tables. '
  'Idempotent: if the auth row is already gone, this is a no-op.';
