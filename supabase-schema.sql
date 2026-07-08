-- Run this in the Supabase SQL editor.
-- Note: because this app is client-side and uses the public anon key, the policies below allow the app to read/write these tables.
-- For truly private access, you would need auth or a server-side proxy with the service role key.

create table if not exists public.tracker_settings (
  id integer primary key default 1,
  theme text not null default 'dark',
  categories jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint tracker_settings_singleton check (id = 1)
);

create table if not exists public.tracker_days (
  day date primary key,
  category_completion jsonb not null default '{}'::jsonb,
  task_values jsonb not null default '{}'::jsonb,
  biggest_win text not null default '',
  learned_today text not null default '',
  improve_tomorrow text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tracker_settings enable row level security;
alter table public.tracker_days enable row level security;

grant usage on schema public to anon;
grant select, insert, update, delete on table public.tracker_settings to anon;
grant select, insert, update, delete on table public.tracker_days to anon;

drop policy if exists "Allow anon read settings" on public.tracker_settings;
create policy "Allow anon read settings"
  on public.tracker_settings
  for select
  to anon
  using (true);

drop policy if exists "Allow anon write settings" on public.tracker_settings;
create policy "Allow anon write settings"
  on public.tracker_settings
  for insert
  to anon
  with check (true);

drop policy if exists "Allow anon update settings" on public.tracker_settings;
create policy "Allow anon update settings"
  on public.tracker_settings
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Allow anon read days" on public.tracker_days;
create policy "Allow anon read days"
  on public.tracker_days
  for select
  to anon
  using (true);

drop policy if exists "Allow anon write days" on public.tracker_days;
create policy "Allow anon write days"
  on public.tracker_days
  for insert
  to anon
  with check (true);

drop policy if exists "Allow anon update days" on public.tracker_days;
create policy "Allow anon update days"
  on public.tracker_days
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Allow anon delete days" on public.tracker_days;
create policy "Allow anon delete days"
  on public.tracker_days
  for delete
  to anon
  using (true);
