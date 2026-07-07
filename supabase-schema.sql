-- Sheepfold — Supabase schema
-- Run this once in Supabase: Project > SQL Editor > New query > paste > Run

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bacenta text,
  bl text,
  phone text,
  missed int default 0,
  status text default 'none',
  complex boolean default false,
  last_visit date,
  created_at timestamptz default now()
);

create table if not exists visitations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  date date not null,
  type text,
  notes text,
  logged_by text,
  created_at timestamptz default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  service_date date not null,
  present boolean not null default false,
  created_at timestamptz default now(),
  unique (member_id, service_date)
);

create table if not exists app_settings (
  id int primary key default 1,
  week_start date,
  week_end date
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

-- Row Level Security: any signed-in leader can read/write.
-- (Small trusted team behind login — no need for per-row ownership.)
alter table profiles enable row level security;
alter table members enable row level security;
alter table visitations enable row level security;
alter table attendance enable row level security;
alter table app_settings enable row level security;

create policy "profiles: read all, write own" on profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles: insert own" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles: update own" on profiles
  for update using (auth.uid() = id);

create policy "members: authenticated full access" on members
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "visitations: authenticated full access" on visitations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "attendance: authenticated full access" on attendance
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "settings: authenticated full access" on app_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Realtime: lets every BL's screen update live when someone else logs a visit
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table visitations;
alter publication supabase_realtime add table attendance;
alter publication supabase_realtime add table app_settings;
