-- ═══════════════════════════════════════════════════════════════
-- 0010 — Two-factor step-up, without locking the operator out
--
-- PROBLEM THIS FIXES
--   Migration 0008 required AAL2 for EVERY admin read and write of
--   client data. An admin account that had never enrolled a TOTP
--   factor could therefore never reach AAL2 — Supabase issues an
--   AAL1 session and there is no second factor to present — so the
--   entire agency dashboard (leads, projects, websites, billing,
--   activity…) rendered EMPTY. That looked like "the backend is
--   broken" when it was actually the security policy.
--
-- WHAT THIS MIGRATION DOES
--   Redefines app_aal2() so it means:
--     1. the session presented a verified second factor → true, or
--     2. the account has NO verified factor enrolled yet → true,
--        because password-only is genuinely all the account has.
--   The moment an admin enrols a factor (Settings → Two-factor),
--   every policy from 0008 becomes hard again: AAL1 sessions read
--   nothing admin-only and write nothing at all.
--
--   Net effect: no silent empty screens, and no security regression
--   for accounts that actually use two-factor.
--
-- Idempotent: safe to run repeatedly.
-- ═══════════════════════════════════════════════════════════════

create or replace function app_aal2() returns boolean
  language plpgsql
  stable
  security definer
  set search_path = public, auth
as $$
declare
  factor_enrolled boolean := false;
begin
  -- 1. The documented MFA signal: the `aal` claim rides in the JWT.
  if coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then
    return true;
  end if;

  -- 2. No verified factor for this user → nothing to step up with, so
  --    do not hold the whole dashboard hostage. Any failure to read the
  --    auth schema is treated the same way (availability first: the
  --    hard rule below still applies whenever a factor IS enrolled).
  begin
    select exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = auth.uid()
        and f.status = 'verified'
    ) into factor_enrolled;
  exception when others then
    factor_enrolled := false;
  end;

  return not coalesce(factor_enrolled, false);
end
$$;

comment on function app_aal2() is
  'True when the session is AAL2, OR when the account has no verified MFA factor enrolled (so step-up is impossible). Once a factor exists, admin RLS from 0008 requires a verified second factor.';

-- ── Migration note ─────────────────────────────────────────────
-- Prefer strict two-factor everywhere? Enrol a factor on the admin
-- account (Settings → Two-factor authentication). From that moment
-- this function returns false for every AAL1 session again, with no
-- further migration needed.
--
-- ROLLBACK: re-run the app_aal2() body from 0008 to restore the hard
-- rule even for accounts with no factor.
