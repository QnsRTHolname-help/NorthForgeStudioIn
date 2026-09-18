-- NorthForge — WhatsApp Cloud API delivery metadata (0011)
--
-- The admin inbox is now a real two-way WhatsApp channel:
--
--   * `whatsapp-send`    — Edge Function that verifies the caller is an
--                          admin, posts the message to the WhatsApp Cloud
--                          API and records the outcome.
--   * `whatsapp-webhook` — Edge Function that receives Meta's webhook:
--                          inbound customer replies (they land in the same
--                          inbox) and delivery/read receipts.
--
-- To correlate delivery receipts with the message we sent, the provider's
-- message id must be stored on the row. This migration adds it. Safe to
-- re-run; nothing is dropped.

alter table whatsapp_messages add column if not exists provider_message_id text;

create index if not exists whatsapp_messages_provider_idx
  on whatsapp_messages (provider_message_id)
  where provider_message_id is not null;
