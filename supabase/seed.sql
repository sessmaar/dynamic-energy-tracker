-- Optional dev seed. Run AFTER signing in as a dev user once so auth.users has
-- a row. Replace :user_id below with the real auth.uid() (psql variable, or
-- substitute manually). The dataset matches the web console's synthetic
-- 12-week cut so dev parity is easy to eyeball.

\set user_id '00000000-0000-0000-0000-000000000000'

insert into public.profiles (id, sex, date_of_birth, height_cm, initial_weight_kg, timezone)
values (:'user_id', 'male', '1992-01-15', 180.0, 79.0, 'UTC')
on conflict (id) do nothing;

insert into public.goals (user_id, goal_type, goal_rate_kg_per_week, start_date, status)
values (:'user_id', 'cut', -0.40, current_date - interval '84 days', 'active')
on conflict do nothing;
