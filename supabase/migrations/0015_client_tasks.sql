-- =========================================================
-- NORTHFORGE — Supabase migration 0015
-- The Daily OS: a client can open and finish their own tasks.
--
-- Sections
--   1. The portal Tasks tab could not write anything at all
--   2. tasks read/write policies brought in line with the 0014 model
--   3. A client's write may only move the columns this page edits
--
-- Why this exists: "Tasks" and "Calendar" are now first-class tabs in the
-- client portal, and the daily-OS strategy depends on an owner being able to
-- jot a task down and tick it off. In 0001 the only policies on `tasks` were
-- `tasks_scope` (SELECT) and `tasks_admin_write` (admin only), so a client
-- pressing "New task" had the insert rejected by RLS: the screen promised a
-- write the database always refused. This adds the narrowest policy pair that
-- makes the promise true, plus a BEFORE trigger so a client's write cannot
-- touch anything the studio owns.
--
-- Non-destructive: policies are replaced, one function is created, no row is
-- read, moved or deleted.
--
-- Safe to re-run.
-- ROLLBACK is listed under each section.
-- Depends on: 0001 (tasks, app_can_see, app_profile_client_id), 0014 (app_aal2).
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. THE CLIENT COULD NOT CREATE OR COMPLETE A TASK
--
-- `client_id = app_profile_client_id()` is the whole security story: the
-- identity comes from the caller's own profile row (security definer, 0001),
-- never from the request body. A client can therefore only open a task on
-- their own account, and only ever touch rows that already belong to it.
-- `client_id is not null` matters because app_profile_client_id() returns NULL
-- for an operator without a client row — NULL = NULL is not true, so the check
-- fails closed rather than admitting an unowned row.
--
-- ROLLBACK: drop policy if exists tasks_client_insert on tasks;
--           drop policy if exists tasks_client_update on tasks;
-- =========================================================

drop policy if exists tasks_client_insert on tasks;
create policy tasks_client_insert on tasks
  for insert to authenticated
  with check (
    client_id is not null
    and client_id = app_profile_client_id()
  );

drop policy if exists tasks_client_update on tasks;
create policy tasks_client_update on tasks
  for update to authenticated
  using (client_id = app_profile_client_id())
  with check (client_id = app_profile_client_id());

-- =========================================================
-- 2. SAME MODEL AS EVERY OTHER CLIENT-FACING TABLE
--
-- 0014 reworked the policies it covered to `to authenticated` with
-- `app_is_admin() and app_aal2()` on the operator path, but `tasks` was left
-- behind: its read policy was open to every role and an operator could write
-- tasks without a second factor. This closes that gap so tasks cannot become
-- the soft spot in an otherwise consistent table.
--
-- ROLLBACK: re-run the tasks_scope / tasks_admin_write pair from 0001.
-- =========================================================

drop policy if exists tasks_scope on tasks;
create policy tasks_scope on tasks
  for select to authenticated using (
    (app_is_admin() and app_aal2()) or app_can_see(client_id)
  );

drop policy if exists tasks_admin_write on tasks;
create policy tasks_admin_write on tasks
  for all to authenticated
  using (app_is_admin() and app_aal2())
  with check (app_is_admin() and app_aal2());

-- =========================================================
-- 3. A CLIENT'S WRITE MAY ONLY MOVE WHAT THE PORTAL EDITS
--
-- RLS cannot restrict columns: a write grant on a row carries every column, so
-- a client could POST straight to PostgREST and set `project_id` (link their
-- task into any project), `assignee_id` (claim or hand work off) or `is_demo`.
-- A BEFORE trigger pins those to their previous values on every path —
-- PostgREST, an RPC or future code — mirroring guard_client_update (0014),
-- which protects `clients` the same way.
--
-- Client-editable by design: title, description, status, priority, due_date.
--
-- ROLLBACK: drop trigger tasks_guard_write on tasks;
--           drop function guard_task_write();
-- =========================================================

create or replace function guard_task_write() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- No JWT (service role, SQL editor, scheduled job): trusted operator.
  if auth.uid() is null then
    return new;
  end if;

  -- An operator with a verified second factor may change anything.
  if app_is_admin() and app_aal2() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A client opens a task on their own account and nothing else.
    new.project_id  := null;
    new.assignee_id := null;
    new.is_demo     := false;
    return new;
  end if;

  new.id          := old.id;
  new.client_id   := old.client_id;
  new.project_id  := old.project_id;
  new.assignee_id := old.assignee_id;
  new.is_demo     := old.is_demo;
  new.created_at  := old.created_at;

  return new;
end $$;

drop trigger if exists tasks_guard_write on tasks;
create trigger tasks_guard_write before insert or update on tasks
  for each row execute function guard_task_write();

-- =========================================================
-- VERIFY
--
--   -- 1. the client policies exist, alongside the operator ones
--   select policyname, cmd, roles::text, qual, with_check
--     from pg_policies where tablename = 'tasks' order by policyname;
--
--   -- 2. the guard is attached
--   select tgname from pg_trigger
--    where tgrelid = 'tasks'::regclass and not tgisinternal;
--
--   -- 3. as a signed-in client (never the service role):
--   --    succeeds, and lands on your own client_id
--   insert into tasks (title, client_id) values ('test', app_profile_client_id());
--   --    rejected, not silently redirected
--   insert into tasks (title, client_id) values ('test', 'cl_someone_else');
--   --    rejected: a task cannot be handed to another account
--   update tasks set client_id = 'cl_someone_else' where title = 'test';
--   --  CLEAN UP:  delete from tasks where title = 'test';
-- =========================================================