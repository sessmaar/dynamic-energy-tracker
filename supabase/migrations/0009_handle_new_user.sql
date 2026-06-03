-- ============================================================================
-- 0009: Auto-bootstrap profile on auth signup.
--
-- This trigger ensures that every new auth user has a row in public.profiles.
-- We use placeholder values for the required fields; these are intended to 
-- be updated by the user during the onboarding flow. This ensures that 
-- repository lookups for "the current user's profile" always return a row, 
-- simplifying the frontend logic.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, 
    sex, 
    date_of_birth, 
    height_cm, 
    initial_weight_kg, 
    timezone, 
    preferred_units
  )
  values (
    new.id, 
    'male', 
    '1990-01-01', 
    175.0, 
    75.0, 
    'UTC', 
    'metric'
  );
  return new;
end;
$$;

-- Trigger must be created on the auth.users table in the auth schema.
-- Note: Migrations running as the 'postgres' or 'service_role' can manage 
-- triggers on auth.users.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is 
  'Ensures a public.profiles row exists for every auth user. Required fields are seeded with placeholders.';
