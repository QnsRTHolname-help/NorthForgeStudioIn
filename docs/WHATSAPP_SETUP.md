# WhatsApp Cloud API — connect the admin inbox

The admin inbox (`/app/whatsapp`) becomes a real two-way WhatsApp channel in
five minutes. What the admin types on the website is delivered by the
business number through Meta's Cloud API, and customer replies arrive in the
same inbox.

## What each piece does

| Piece | Role |
| --- | --- |
| `supabase/functions/whatsapp-send` | Verifies the caller is an admin, posts the message to the Graph API, records `sent` / `failed` + the provider message id. |
| `supabase/functions/whatsapp-webhook` | Receives Meta's webhook: inbound customer replies and delivery/read receipts. |
| `whatsapp_messages.provider_message_id` | Links receipts to the row we sent (migration `0011`). |

Until these are configured, every send still works: the message is recorded
**queued** and a `wa.me` link opens the business WhatsApp with the exact
text pre-typed — nothing pretends to be delivered.

## Steps

1. **Meta app** — developers.facebook.com → *Create app* → type **Business** →
   add the **WhatsApp** product. WhatsApp → *API Setup* shows the test number
   and the **Phone number ID** (copy it). Add your real business number when
   ready.
2. **Token** — WhatsApp → *API Setup* → generate a token, or create a
   permanent **System User** token in Business Settings (recommended).
3. **Secrets** — from the repo root, with the Supabase CLI linked
   (`supabase link --project-ref <ref>`):
   ```bash
   supabase secrets set \
     WHATSAPP_ACCESS_TOKEN=EAAG… \
     WHATSAPP_PHONE_NUMBER_ID=1234567890 \
     WHATSAPP_VERIFY_TOKEN=any-string-you-choose
   ```
4. **Migrations** — apply `supabase/migrations/0011_whatsapp_provider_id.sql`
   in the Supabase SQL editor (safe to re-run).
5. **Deploy the functions**:
   ```bash
   supabase functions deploy whatsapp-send
   supabase functions deploy whatsapp-webhook --no-verify-jwt
   ```
6. **Webhook** — Meta App Dashboard → WhatsApp → *Configuration*:
   - Callback URL: `https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`
   - Verify token: the same `WHATSAPP_VERIFY_TOKEN` value from step 3
   - Subscribe to the **messages** field.

The inbox **Connection** card flips to **Cloud API** automatically once the
secrets are set (the UI probes the deployed function; it never fakes it).

## Behaviour notes

- Free-form text can only be delivered within 24 hours of the customer's
  last message. Outside that window Meta rejects with code `131047` — the
  inbox shows exactly that guidance, and approved templates (WhatsApp →
  Templates → New) are the way out.
- Replies thread by the customer's number; the client name shows when the
  digits match a client's phone.
- Numbers are normalised India-first: `98450 12345`, `09845…`, `+91 …` all
  become `919845012345`. International numbers work when typed with their
  country code.
- The webhook stores inbound messages and updates sent → delivered → read
  receipts; failures from Meta are recorded with a human reason.
