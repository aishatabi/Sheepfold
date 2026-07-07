-- Sheepfold — Supabase schema
-- Run this once in Supabase: Project > SQL Editor > New query > paste > Run

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'bl' check (role in ('admin','bl')),
  bacenta text,
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

-- Checks admin status without triggering recursive row-level-security checks.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role from profiles where id = auth.uid()) = 'admin', false);
$$;

create policy "profiles: read all, write own" on profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles: insert own" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles: update own or admin" on profiles
  for update using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());

create policy "members: admin or own bacenta" on members
  for all
  using (is_admin() or bacenta = (select bacenta from profiles where id = auth.uid()))
  with check (is_admin() or bacenta = (select bacenta from profiles where id = auth.uid()));

create policy "visitations: admin or own bacenta" on visitations
  for all
  using (
    is_admin() or member_id in (
      select id from members where bacenta = (select bacenta from profiles where id = auth.uid())
    )
  )
  with check (
    is_admin() or member_id in (
      select id from members where bacenta = (select bacenta from profiles where id = auth.uid())
    )
  );

create policy "attendance: admin or own bacenta" on attendance
  for all
  using (
    is_admin() or member_id in (
      select id from members where bacenta = (select bacenta from profiles where id = auth.uid())
    )
  )
  with check (
    is_admin() or member_id in (
      select id from members where bacenta = (select bacenta from profiles where id = auth.uid())
    )
  );

create policy "settings: authenticated full access" on app_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Realtime: lets every BL's screen update live when someone else logs a visit
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table visitations;
alter publication supabase_realtime add table attendance;
alter publication supabase_realtime add table app_settings;

-- LAST STEP — after adding yourself as a user (see README) and signing in once
-- so your profile row exists, run this one line by itself with your own email
-- to make yourself the administrator:
--
-- update profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR-EMAIL-HERE');
