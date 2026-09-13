-- =========================================================
-- NORTHFORGE — Supabase migration 0006
--
-- Fixes two real gaps:
--
--   1. Contact-form submissions landed in `enquiries` but never appeared
--      in Leads, so the details a prospect typed (business type, tools,
--      bottleneck, message) were invisible to the team. Every enquiry now
--      automatically becomes a `leads` row (source 'website', status
--      'new') with the full submitted details composed into the message.
--      The existing `leads_event_engine` trigger (0004) then notifies
--      admins and writes the activity record — one pipeline, one event.
--
--   2. Existing enquiries are backfilled into leads (guarded by email, so
--      re-running never duplicates).
--
-- Non-destructive: CREATE OR REPLACE / CREATE TRIGGER / INSERT-SELECT only.
-- Depends on: 0004 (event engine) and 0005 (enquiries trigger wiring).
-- =========================================================

-- Replace 0005's notification-only handler: the lead row itself is now the
-- notification pipeline, so admins get exactly one "New lead" alert per
-- enquiry (no double-notify), with all typed details attached.
create or replace function on_enquiry_created() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_details text;
begin
  begin
    v_details := concat_ws(
      E'\n',
      nullif(new.message, ''),
      nullif('Bottleneck: ' || new.bottleneck, 'Bottleneck: '),
      nullif('Monthly enquiries: ' || new.monthly_enquiries, 'Monthly enquiries: '),
      nullif('Tools today: ' || new.current_tools, 'Tools today: ')
    );

    insert into leads (business_name, contact_name, email, phone, source, status, message, next_action)
    values (
      new.business_name,
      new.name,
      new.email,
      new.whatsapp,
      'website',
      'new',
      nullif(v_details, ''),
      case when new.whatsapp is not null then 'Follow up on WhatsApp' else 'Reply by email' end
    );

    perform nf_log_activity(
      'enquiry.created', 'Contact form submitted',
      coalesce(new.business_name, new.name),
      coalesce(new.name, 'Website'), 'system',
      'enquiry', new.id, null
    );
  exception when others then
    -- A failure here must never block a public submission.
    null;
  end;
  return new;
end $$;

drop trigger if exists enquiries_event_engine on enquiries;
create trigger enquiries_event_engine after insert on enquiries
  for each row execute function on_enquiry_created();

-- Backfill: turn enquiries that were submitted before this migration into
-- leads. Guarded by email + business name so re-running cannot duplicate.
insert into leads (business_name, contact_name, email, phone, source, status, message, next_action)
select
  e.business_name,
  e.name,
  e.email,
  e.whatsapp,
  'website',
  'new',
  nullif(concat_ws(
    E'\n',
    nullif(e.message, ''),
    nullif('Bottleneck: ' || e.bottleneck, 'Bottleneck: '),
    nullif('Monthly enquiries: ' || e.monthly_enquiries, 'Monthly enquiries: '),
    nullif('Tools today: ' || e.current_tools, 'Tools today: ')
  ), ''),
  case when e.whatsapp is not null then 'Follow up on WhatsApp' else 'Reply by email' end
from enquiries e
where e.email is not null
  and not exists (
    select 1 from leads l
    where lower(l.email) = lower(e.email)
      and l.business_name is not distinct from e.business_name
  );
