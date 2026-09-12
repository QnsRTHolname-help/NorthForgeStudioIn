-- =========================================================
-- NORTHFORGE — Post-migration setup (run AFTER 0001 and 0002)
--
-- Purpose:
--   1. Backfill `profiles` rows for auth users created BEFORE the
--      schema existed (the signup trigger could not fire for them).
--   2. Create/promote the admin profile (role = 'admin').
--
-- BEFORE RUNNING: replace YOUR_ADMIN_EMAIL@example.com below with
-- the admin email you chose.
--
-- Safe to re-run — every statement is idempotent.
-- =========================================================

-- 1a. Backfill: create a client workspace for users who signed up with a
--      business name (the signup trigger did not exist for them either).
insert into public.clients (business_name, contact_name, email, phone, business_type, status)
select
  u.raw_user_meta_data ->> 'business_name',
  coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)),
  u.email,
  nullif(u.raw_user_meta_data ->> 'phone', ''),
  nullif(u.raw_user_meta_data ->> 'business_type', ''),
  'onboarding'
from auth.users u
where nullif(u.raw_user_meta_data ->> 'business_name', '') is not null
  and not exists (
    select 1 from public.clients c where lower(c.email) = lower(u.email)
  );

-- 1b. Backfill: create a profile for every auth user that has none,
--     linking to their client workspace when one exists.
insert into public.profiles (id, email, name, role, client_id, phone)
select
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)),
  'client'::user_role,
  c.id,
  nullif(u.raw_user_meta_data ->> 'phone', '')
from auth.users u
left join public.clients c on lower(c.email) = lower(u.email)
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 2. Admin: set your chosen admin email here ⬇️
--    The password itself is set in Dashboard → Authentication → Users.
insert into public.profiles (id, email, name, role)
select u.id, u.email, 'Admin', 'admin'::user_role
from auth.users u
where lower(u.email) = lower('owner@example.com')
on conflict (id) do update set role = 'admin';

-- 3. Show the result so you can verify.
select p.id, p.email, p.role, p.client_id, p.created_at
from public.profiles p
order by p.created_at;
