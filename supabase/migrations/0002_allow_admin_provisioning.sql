-- =========================================================
-- NORTHFORGE — Supabase migration 0002
--
-- Fix: guard_profile_update() blocked EVERY role change, including
-- trusted provisioning from the SQL editor or a service-role backend.
--
-- Why: app_is_admin() resolves the caller from auth.uid() (the browser
-- JWT). The SQL editor and server-side jobs have no JWT, so the guard
-- read them as "non-admin" and silently reverted
--   update profiles set role = 'admin' …
-- making admin provisioning impossible.
--
-- Fix: the lock-down now applies only when a user JWT is present.
--   * Browser, authenticated user → role/client_id locked (unchanged)
--   * Browser, anonymous          → cannot write at all (RLS denies;
--     there is no UPDATE policy for anon)
--   * SQL editor / service role   → trusted provisioning allowed
--
-- Non-destructive: CREATE OR REPLACE only. Safe to re-run.
-- =========================================================

create or replace function guard_profile_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_admin() then
    new.role = old.role;
    new.client_id = old.client_id;
    new.is_demo = old.is_demo;
  end if;
  return new;
end $$;

-- No trigger re-creation needed: drop/create happens in 0001 and the
-- trigger references the function by name, so replacing the function
-- body is enough.
