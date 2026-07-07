-- Adds role-based access: you (the admin) see everything; each Bacenta Leader
-- only sees members, attendance, and visitations for their own bacenta.
--
-- Run this once in Supabase → SQL Editor → New query → paste all of it → Run.

alter table profiles add column if not exists role text not null default 'bl' check (role in ('admin','bl'));
alter table profiles add column if not exists bacenta text;
alter table profiles add column if not exists email text;

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

-- profiles: you can update anyone's role/bacenta; everyone can still edit their own name.
drop policy if exists "profiles: update own" on profiles;
drop policy if exists "profiles: update own or admin" on profiles;
create policy "profiles: update own or admin" on profiles
  for update using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());

-- members: you see/edit everything; a BL only sees/edits members in their bacenta.
drop policy if exists "members: authenticated full access" on members;
create policy "members: admin or own bacenta" on members
  for all
  using (is_admin() or bacenta = (select bacenta from profiles where id = auth.uid()))
  with check (is_admin() or bacenta = (select bacenta from profiles where id = auth.uid()));

-- visitations: scoped through the member's bacenta.
drop policy if exists "visitations: authenticated full access" on visitations;
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

-- attendance: same pattern.
drop policy if exists "attendance: authenticated full access" on attendance;
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

-- LAST STEP — do this separately, after the block above has run successfully:
-- Replace the email with the one you sign into Sheepfold with, then run just
-- this one line by itself. This makes you the administrator.
--
-- update profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR-EMAIL-HERE');
