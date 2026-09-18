# Privacy, data lifecycle and launch checklist

This document records the behaviour the code actually implements, so the
privacy policy and the product cannot drift apart. Everything below is
verifiable from the migrations in `supabase/migrations/` and the service layer
in `src/services/`.

---

## 1. Account deletion — what actually happens

Client-initiated: **Settings → Danger zone → Delete this account**. The
confirmation requires typing the business name, and the whole thing runs in one
transaction inside `app_delete_own_account()` (migrations `0009` + `0012`).

The caller is resolved from `auth.uid()` inside the database. There is no
"delete=true" flag, no user id parameter, and no client id parameter — an
account can only ever delete itself, and admin/super-admin accounts are refused
outright (privileged accounts are off-boarded by a super admin).

| Data | Outcome |
| --- | --- |
| `auth.users` row (login) | **Deleted** |
| `profiles` row | **Deleted** (cascades from the auth user) |
| `clients` workspace row | **Deleted** |
| Leads, follow-ups, proposals | **Deleted** (cascade) |
| Projects, milestones, tasks | **Deleted** (cascade) |
| Websites, website analytics | **Deleted** (cascade) |
| Bookings, requests, tickets, files | **Deleted** (cascade) |
| WhatsApp messages | **Deleted** (cascade) |
| Notifications, notification preferences | **Deleted** (cascade from the auth user) |
| Onboarding drafts | **Deleted** (cascade) |
| Storage objects under `client-files/{client_id}/…` | **Deleted** explicitly (object storage has no FK) |
| **`subscriptions`** | **Deleted** (cascade) — but see §2: cancellation is the normal path, not deletion |
| **`invoices`** | **Retained**, detached (`client_id` → null) |
| **`payments`** | **Retained**, detached (`client_id` → null) |
| Audit rows in `activity` | Cascaded away with the client, **except** the final `auth.account_deleted` record (no `client_id`), which is kept as the security audit trail |
| Backups | Supabase backups keep a copy until the backup rotates out — deletion from the live system is immediate, deletion everywhere is not |

**Anonymisation:** no record is currently anonymised. Records either cascade
away with the account or are retained as-is for accounting/audit reasons. This
is stated plainly rather than claiming a pseudonymisation step that does not
exist.

**Financial retention is deliberate.** `invoices.client_id` and
`payments.client_id` were moved from `ON DELETE CASCADE` to
`ON DELETE SET NULL` in migration `0012`, because cascade-deleting them would
destroy the accounting record of money already invoiced and paid. A
`BEFORE DELETE ON clients` trigger snapshots the business name into
`billed_to` first, so a retained invoice stays attributable instead of becoming
an unnamed row. Retained financial rows are readable by admins only:
`invoices_scope` uses `app_can_see(client_id)`, which is false for a client
when `client_id` is null.

---

## 2. Plan cancellation — what actually happens

Client-initiated: **Portal → My subscription → Cancel plan**. Clients hold
`SELECT` on their own subscription only, so the state change goes through
`app_cancel_own_subscription(subscription_id, reason)` (migration `0012`),
which resolves the caller from `auth.uid()` and takes no client id.

| Case | Result |
| --- | --- |
| Renewal date is in the future | `status = cancellation_pending`, `cancel_at = renews_at` — access continues to the end of the paid period |
| Nothing is outstanding / renewal date has passed | `status = cancelled`, `cancel_at = now()` |
| Already `cancelled` / `expired` | Refused with a clear message |
| Subscription row | **Never deleted** — `cancelled_at`, `cancellation_reason`, `cancelled_by` are recorded |
| Invoices already issued | **Untouched.** Their own status is unchanged; an unpaid invoice stays payable |
| Notifications | Client confirmation + admin notification + `activity` audit row |

Admin-side: the admin Subscriptions page now supports
`cancellation_pending` and `expired`, warns when clients have cancelled, and
shows who cancelled, when, and why.

---

## 3. Age verification — what is collected

Signup requires a single checkbox: **"I am 18 or older"**. Stored:

- `profiles.age_verified` (boolean, set by `handle_new_user()`)
- `profiles.age_verified_at` (timestamptz)

Not collected: date of birth, passport, Aadhaar, driving licence, or any other
identity document. A basic eligibility check does not justify collecting
identity documents, so the policy and the form do not ask for them.

The minimum age (18) is a product decision for a business-services offering,
not a legal claim invented by the code. If the business decides a different
threshold applies, change the checkbox label in
`src/pages/public/Register.tsx` and the wording in `src/pages/public/Legal.tsx`
together.

---

## 4. Third-party services actually used

| Provider | Where | Why |
| --- | --- | --- |
| Supabase | `src/lib/supabase.ts`, `supabase/migrations/*` | Auth, Postgres, storage, RLS, optional edge functions |
| Vercel | `vercel.json` | Hosting the built SPA |
| Google Fonts | `index.html` | Inter + JetBrains Mono via `fonts.googleapis.com` |
| Google Analytics 4 | `src/lib/analytics.ts` | Public-site analytics — **only if `VITE_GA4_ID` is set AND the visitor consents** |
| Google Search Console | `src/lib/analytics.ts` | `google-site-verification` meta tag only; not visitor tracking |
| Meta / WhatsApp | `src/data/site.ts`, `supabase/functions/whatsapp-*` | Click-to-chat (`wa.me`) for visitors; optional Cloud API for the admin inbox |
| `api.qrserver.com` | `src/pages/portal/Settings.tsx` | Renders the 2FA enrolment QR image. The manual-key path in the same panel avoids this request |

No advertising, marketing or data-broker services are integrated. The privacy
policy table is kept in step with this list.

---

## 5. Manual steps that cannot be done from the codebase

Nothing here has been done for you, and none of it should be described as
"verified" until it is actually verified on the provider side.

### Supabase
1. Apply migrations in order, including the new
   `supabase/migrations/0012_age_gate_and_plan_cancellation.sql`
   (and `0011_whatsapp_provider_id.sql` if not yet applied). Both are
   non-destructive and safe to re-run.
2. Confirm Auth → Email confirmation is enabled, and that the Site URL /
   redirect URLs include the production domain plus `/auth/callback`.
3. Confirm the storage bucket `client-files` exists and is private.

### Vercel
1. Set environment variables per environment (Production, Preview, Development):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `VITE_SITE_URL` (the real production domain — it drives canonical URLs, OG
     tags and the generated sitemap)
   - `VITE_WHATSAPP_NUMBER` (digits only, e.g. `919187006703`)
   - `VITE_GA4_ID` — only after the GA4 property exists
   - `VITE_GOOGLE_SITE_VERIFICATION` — after Search Console verification starts
2. Never set a Supabase service-role/secret key as a `VITE_*` variable. The
   service-role key is only used inside the Supabase edge functions, where it
   stays server-side.
3. Redeploy after changing any `VITE_*` value — they are baked into the bundle
   at build time.

### Google Analytics 4
1. Create the GA4 property and copy the measurement ID (`G-XXXXXXXXXX`).
2. Set `VITE_GA4_ID` and redeploy. With it unset, no analytics script is
   requested at all.
3. Verify in the browser that gtag is **not** requested before a visitor
   chooses "Allow analytics".

### Google Search Console
1. Add the production domain as a URL-prefix property.
2. Use the HTML tag method, copy the `content` value, set
   `VITE_GOOGLE_SITE_VERIFICATION`, redeploy, then click Verify in Search
   Console.
3. Submit `https://<domain>/sitemap.xml` once the build is live. The sitemap is
   generated at build time by `scripts/generate-sitemap.mjs`.

### Google Business Profile
1. Create/claim the listing with the same business name, phone and website that
   appear in `src/data/site.ts`.
2. Do not add a street address unless there is a real one customers can visit —
   `organizationSchema()` deliberately publishes a locality and service area
   only.

### WhatsApp
- Visitor-facing: nothing to configure beyond `VITE_WHATSAPP_NUMBER`; the link
  opens the visitor's own WhatsApp.
- Admin inbox (optional): see `docs/WHATSAPP_SETUP.md`. Until
  `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_VERIFY_TOKEN`
  are set as edge-function secrets, the inbox records sends as *queued* and
  falls back to `wa.me` links. It never reports a message as delivered that was
  not.
