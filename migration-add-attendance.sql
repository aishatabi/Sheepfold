-- Run this ONLY if you already ran supabase-schema.sql before (i.e. you deployed
-- the app before attendance tracking existed). It just adds the new attendance
-- table without touching anything that already exists.
--
-- If you're setting this up fresh, ignore this file — supabase-schema.sql
-- already includes everything below.

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  service_date date not null,
  present boolean not null default false,
  created_at timestamptz default now(),
  unique (member_id, service_date)
);

alter table attendance enable row level security;

create policy "attendance: authenticated full access" on attendance
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table attendance;
