-- Run this in the Supabase SQL editor.
-- This script upgrades the tracker tables to authenticated, per-user storage.
-- If you already have legacy anonymous rows and want to keep them, backfill user_id manually first.

alter table if exists public.tracker_settings
  add column if not exists user_id uuid;

alter table if exists public.tracker_days
  add column if not exists user_id uuid;

alter table if exists public.tracker_settings
  alter column user_id set default auth.uid();

alter table if exists public.tracker_days
  alter column user_id set default auth.uid();

create unique index if not exists tracker_settings_user_id_key
  on public.tracker_settings (user_id);

create unique index if not exists tracker_days_user_day_key
  on public.tracker_days (user_id, day);

alter table public.tracker_settings enable row level security;
alter table public.tracker_days enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.tracker_settings to authenticated;
grant select, insert, update, delete on table public.tracker_days to authenticated;

drop policy if exists "tracker_settings_select_own" on public.tracker_settings;
create policy "tracker_settings_select_own"
  on public.tracker_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "tracker_settings_insert_own" on public.tracker_settings;
create policy "tracker_settings_insert_own"
  on public.tracker_settings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "tracker_settings_update_own" on public.tracker_settings;
create policy "tracker_settings_update_own"
  on public.tracker_settings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tracker_settings_delete_own" on public.tracker_settings;
create policy "tracker_settings_delete_own"
  on public.tracker_settings
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "tracker_days_select_own" on public.tracker_days;
create policy "tracker_days_select_own"
  on public.tracker_days
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "tracker_days_insert_own" on public.tracker_days;
create policy "tracker_days_insert_own"
  on public.tracker_days
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "tracker_days_update_own" on public.tracker_days;
create policy "tracker_days_update_own"
  on public.tracker_days
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tracker_days_delete_own" on public.tracker_days;
create policy "tracker_days_delete_own"
  on public.tracker_days
  for delete
  to authenticated
  using (auth.uid() = user_id);
