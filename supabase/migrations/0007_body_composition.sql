-- ---------------------------------------------------------------------------
-- 0007_body_composition — tape measurements, body-fat, and progress photos
-- ---------------------------------------------------------------------------
-- Adds two user-owned tables plus Storage policies for a private photo
-- bucket. body_measurements feeds the engine: circumferences → U.S. Navy
-- %BF → lean mass → Katch–McArdle RMR. progress_photos is qualitative
-- only (no validated photo→body-fat method exists) and feeds nothing.
--
-- NOTE: the Storage bucket itself ('progress-photos', private) must be
-- created once in the Supabase dashboard (Storage → New bucket). This
-- migration only adds the row tables and the per-owner access policies.

-- body_measurements — one row per logged assessment ------------------------
create table public.body_measurements (
  id            uuid         primary key default gen_random_uuid(),
  user_id       uuid         not null references auth.users(id) on delete cascade,
  date          date         not null,
  neck_cm       numeric(5,1) check (neck_cm  is null or neck_cm  > 0),
  waist_cm      numeric(5,1) check (waist_cm is null or waist_cm > 0),
  hip_cm        numeric(5,1) check (hip_cm   is null or hip_cm   > 0),
  weight_kg     numeric(5,2) check (weight_kg is null or weight_kg > 0),
  -- Directly measured body-fat fraction (0..1) from DEXA / smart scale /
  -- calipers / import. Null when the value is derived from circumferences.
  body_fat_pct  numeric(4,3) check (body_fat_pct is null or (body_fat_pct >= 0 and body_fat_pct <= 1)),
  source        text         not null default 'manual'
                  check (source in ('manual', 'import', 'healthkit')),
  note          text,
  created_at    timestamptz  not null default timezone('utc', now())
);
create index body_measurements_user_date on public.body_measurements (user_id, date desc);

-- progress_photos — pointers into the private Storage bucket ----------------
create table public.progress_photos (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  date          date        not null,
  storage_path  text        not null,
  note          text,
  created_at    timestamptz not null default timezone('utc', now())
);
create index progress_photos_user_date on public.progress_photos (user_id, date desc);

-- Row Level Security (mirrors the owner pattern from 0001) ------------------
alter table public.body_measurements enable row level security;
alter table public.progress_photos   enable row level security;

create policy body_measurements_owner on public.body_measurements
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy progress_photos_owner on public.progress_photos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Storage policies for the 'progress-photos' bucket. Objects are namespaced
-- by user id as the first path segment (e.g. '<uid>/2026-06-02-front.jpg'),
-- so owner access is keyed on that segment matching auth.uid().
create policy progress_photos_storage_read on storage.objects
  for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy progress_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy progress_photos_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
