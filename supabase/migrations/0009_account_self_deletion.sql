-- ═══════════════════════════════════════════════════════════════
-- 0009 — Client self-service account deletion (GDPR-style erasure)
--
-- Supabase intentionally does NOT expose self-deletion through the
-- publishable (anon) key: delete-a-user requires service-role rights.
-- The safe, standard pattern is a SECURITY DEFINER RPC that runs with
-- the function owner's rights but resolves the caller from auth.uid():
--
--   • Only the signed-in user can delete THEIR OWN account (the function
--     reads auth.uid() — no email/id parameter exists to pass).
--   • Only CLIENT accounts may self-delete. Admins and super admins are
--     refused: an operator with privileged access must be off-boarded
--     by another super admin in the dashboard (spec §17: no public path
--     may remove an admin).
--   • The client's business rows (leads, invoices, files, requests…)
--     cascade with the `clients` row; the auth user is removed last,
--     which cascades the profile. Storage objects under the client's
--     folder are listed and deleted (objects have no FK for the DB to
--     cascade).
--   • Runs in one transaction: any failure rolls the whole thing back,
--     so the account can never be half-deleted.
--
-- Non-destructive to install: CREATE OR REPLACE + a grant. Safe to run
-- repeatedly. ROLLBACK SAFETY: drop function app_delete_own_account();
-- ═══════════════════════════════════════════════════════════════

create or replace function app_delete_own_account()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_role text;
  v_client_id text;
  v_object_paths text[];
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Sign in before deleting an account.';
  end if;

  select role::text, client_id into v_role, v_client_id from profiles where id = v_uid;
  if v_role is null then
    -- No profile: nothing business-side to remove, just drop the auth user.
    delete from auth.users where id = v_uid;
    return 'deleted';
  end if;

  -- Admins and super admins cannot self-delete from the portal (spec §17):
  -- privileged accounts are off-boarded by a super admin in the dashboard.
  if v_role in ('admin', 'super_admin') then
    raise exception 'ADMIN_CANNOT_SELF_DELETE'
      using hint = 'Privileged accounts must be removed by a super admin.';
  end if;

  -- Storage: collect the client folder's object paths (paths are
  -- `{client_id}/…` by construction, see migration 0004) and delete the
  -- objects explicitly — storage.objects has no FK for cascade.
  if v_client_id is not null then
    select coalesce(array_agg(path), '{}') into v_object_paths
      from storage.objects
      where bucket_id = 'client-files'
        and path[1] = v_client_id;

    if array_length(v_object_paths, 1) > 0 then
      delete from storage.objects
        where bucket_id = 'client-files'
          and path[1] = v_client_id;
    end if;
  end if;

  -- Remove the client workspace row: every business table references it
  -- with `on delete cascade` (migration 0001), so leads, projects,
  -- subscriptions, invoices, payments, bookings, files, whatsapp_messages,
  -- requests, tickets and follow-ups are erased with it.
  if v_client_id is not null then
    delete from clients where id = v_client_id;
  end if;

  -- Finally the auth user. `profiles.id references auth.users on delete
  -- cascade` removes the profile; the auth.activity row for this event is
  -- written BEFORE the deletion (below) so the audit trail survives.
  insert into activity (type, label, detail, actor, actor_role, entity_type, entity_id)
    values ('auth.account_deleted', 'Account deleted by user', 'Self-service deletion requested', 'unknown', 'client', 'profile', v_uid::text);

  delete from auth.users where id = v_uid;

  return 'deleted';
end $$;

-- Who may call it: any signed-in user (the function itself enforces the
-- client-only rule). Revoked from anon/public explicitly.
revoke all on function app_delete_own_account() from public;
revoke all on function app_delete_own_account() from anon;
grant execute on function app_delete_own_account() to authenticated;
