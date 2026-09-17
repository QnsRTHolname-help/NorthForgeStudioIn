# NorthForge — Supabase & Vercel Production Setup

The backend is **Supabase**: Supabase Auth owns credentials, `profiles` owns
application identity (role + client linkage), and Row Level Security on every
table is the real security boundary. The frontend talks to Supabase directly
through one client (`src/lib/supabase.ts`) and one service layer
(`src/services/index.ts`).

## 1. Database — run the migrations

In the Supabase dashboard (SQL Editor) or via the CLI, run — in order:

```
supabase/migrations/0001_northforge_supabase.sql
supabase/migrations/0002_allow_admin_provisioning.sql
supabase/migrations/0003_super_admin_role_management.sql
supabase/migrations/0004_announcements_prefs_files_milestones_event_engine.sql
supabase/migrations/0005_fix_enquiries_public_insert.sql
supabase/migrations/0006_enquiries_become_leads.sql
supabase/migrations/0007_enquiries_plan.sql
supabase/migrations/0008_aal2_admin_enforcement.sql
```

## Security hardening (this release)

- **0008** enforces a **server-verified second factor** for admin access:
  admin SELECT/ALL policies require `app_aal2()` (a session verified with a
  TOTP code), and `guard_profile_update` requires it for role changes. Admins
  enrol via Settings → **Two-factor authentication**. Until an admin enrols,
  admin surfaces return permission errors — that is the enforcement working.
- **Sessions no longer live in localStorage.** The browser keeps access
  tokens in memory only and refresh tokens in tab-scoped sessionStorage
  (`src/lib/supabase.ts`), so a script injection cannot quietly lift a
  usable token. Pair with the dashboard setting below.
- **Dashboard recommendations** (Authentication → Settings): lower the
  access-token TTL to **10 minutes**; leave Supabase's built-in auth rate
  limits enabled (the UI also maps `AUTH_RATE_LIMIT` errors onto a friendly
  cooldown message).
- **Password policy**: 12+ characters with mixed case, a number and a symbol,
  enforced identically client-side (live strength meter) and by Supabase
  via the same shared module; leak-pattern checks reject `word+year` and
  breached classics.

They are **non-destructive**: only `CREATE` / `CREATE OR REPLACE` /
`drop policy if exists` statements. Safe to re-run; no tables are dropped.
0001 provisions:

- `clients`, `profiles` (id = `auth.users.id`), and every business table
- the `handle_new_user` signup trigger — public signup can **only** create
  role `client`, no matter what metadata the browser sends
- `guard_profile_update` — a non-admin can never change their own
  `role` / `client_id`
- RLS enabled on every table with explicit policies
  (admin = all; client = own rows only; enquiries = public insert, admin read)

0002 / 0003 lock role changes to super admins and add auth activity logging.
0004 provisions the operating-system layer:

- **`announcements`** (§18) — admin broadcasts to all clients, selected
  clients, or internal admins; clients read only published rows addressed
  to them (RLS)
- **`notification_preferences`** (§6) — per-user switches; the signup
  trigger seeds defaults; the event engine honours them
- **`milestones`** (§25) — project milestones; completion is stamped
  server-side (`guard_milestone_status`)
- **`files`** + private **`client-files` storage bucket** (§26–§27) —
  objects live under `{client_id}/…`; storage policies derive access from
  the same RLS identity (`app_can_see` / `app_is_admin`); never public URLs
- **Event engine** (§8, §9, §46, §54) — security-definer triggers turn
  database events into notifications (respecting preferences) and activity
  records: leads created, requests/tickets created + status changes,
  bookings, invoice/payment events, task assignment + completion, client
  status changes, announcements published. The backend — not browser
  JavaScript — is the source of truth.

0005 fixes the public contact form: it re-creates the anonymous/authenticated
INSERT policy on `enquiries`, re-grants the table privileges, and adds an
event-engine trigger so every new contact submission notifies admins and is
written to the activity trail (exception-guarded, never blocks a submission).

0006 turns every contact-form enquiry into a `leads` row (with a guarded
backfill of existing enquiries), so submissions surface in the CRM pipeline
instead of hiding in an admin-only table.

0007 adds a nullable `plan` column to `enquiries` so the public contact form
can record which plan an enquirer is interested in (prefilled from
`/pricing?plan=…`). Until it is applied, submissions still succeed — the
service layer detects the missing column and folds the plan into the message
text instead.

0006 turns every contact submission into a **lead**: the enquiry's full typed
details (business type, tools, bottleneck, message) are composed into the
`leads.message`, the existing `leads_event_engine` trigger raises the "New
lead" admin notification and activity record, and pre-existing enquiries are
backfilled into leads (guarded by email so re-running never duplicates).

## 2. Auth configuration (Supabase dashboard → Authentication)

| Setting | Value |
| --- | --- |
| Provider | Email (password) |
| Confirm email | ON (recommended for production) |
| Site URL | `https://your-production-domain.com` |
| Redirect URLs | production domain, `https://*-your-team.vercel.app` (preview wildcard), `http://localhost:5173` |
| Password min length | 8 |

The reset flow uses **PKCE**: the recovery link signs the user into
`/reset-password`, the client exchanges the code automatically
(`detectSessionInUrl`), the page verifies a recovery session exists, then
updates the password. No `?token=` parameter is involved.

### Email deliverability — "I'm not receiving the verification email"

Supabase's built-in mailer has a **hard rate limit of ~2 emails/hour** and
sends from a shared sender that frequently lands in spam. For anything past
local testing, attach a transactional email provider:

1. **Create a provider account** (Resend, Postmark or Mailgun all work —
   Resend has a generous free tier and a 5-minute setup).
2. **Verify your domain** with them (add the DKIM/SPF DNS records they give
   you) — this is what keeps mail out of spam.
3. **Supabase dashboard → Project Settings → Authentication → SMTP Settings**:
   enable *Custom SMTP* and enter the provider's SMTP host/port/user/password.
   Sender: something like `NorthForge <no-reply@your-domain.com>`.
4. **Authentication → Emails → Templates**: update the *Confirm signup*
   template's link to `{{ .SiteURL }}/login?confirmed=true` (and *Reset
   password* to `{{ .SiteURL }}/reset-password`) so links land on the app
   instead of the bare site URL. Keep the `{{ .ConfirmationURL }}` token as
   the actual href.
5. While testing without custom SMTP: check **spam/junk** first, then
   Authentication → Users → your user → "Send confirmation email" to resend
   manually. Rate-limit errors surface in the app as a cooldown message.

### Email confirmation is enforced in the app — keep the toggle ON

Supabase's **"Confirm email"** toggle (Authentication → Providers → Email)
should stay **ON**. The app enforces confirmation on top of it, so even if
the toggle is accidentally switched off, unverified users still cannot use
the product:

- `signUp` throws away any session Supabase issues for an unconfirmed
  address and shows the "check your inbox" screen instead.
- `signInWithPassword` signs out and rejects unconfirmed self-service
  accounts with `AUTH_EMAIL_NOT_CONFIRMED`; the login screen then offers a
  "Resend verification email" button.
- `authService.me()` (bootstrap) refuses to restore a session for an
  unconfirmed address.

Admin-provisioned users (invited via the admin dashboard) are exempt — they
are created with a confirmed address by design. Leaving the toggle ON is
still recommended: it makes Supabase itself refuse the login, so the
protection does not depend on client-side code paths.

For the **self-hosted Express stack**, the same is done with env vars —
set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` and
`APP_URL` in `.env`; signup/reset mail is then delivered through
`nodemailer` (`server/src/services/mailer.ts`) and every send is recorded
in the `email_outbox` table for auditing. Without SMTP configured, mail is
queued there (status `queued`) instead of being silently dropped.

## 3. Environment variables (spec §26, §61)

Vite only exposes **`VITE_`-prefixed** variables to the browser. Set both
pairs in every environment:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | public | Project URL used by the browser client |
| `VITE_SUPABASE_ANON_KEY` | public | Publishable (anon) key — safe because RLS governs access |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | server-side (optional) | Future server/edge use |
| `SUPABASE_SECRET_KEY` | server-side only | **NEVER** in a `VITE_` variable, never in the bundle |
| `VITE_SITE_URL` | public | Canonical URLs + sitemap generation |
| `VITE_WHATSAPP_NUMBER` | public | Click-to-chat deep links |

**Vercel**: set these separately for Production, Preview and Development
(Project → Settings → Environment Variables), then **redeploy** — variable
changes do not apply to existing deployments. Verify Preview has its own
variables; a missing Preview var makes preview builds behave differently
from local development.

**Environment matrix (never cross-connect):**

| | Development | Preview | Production |
| --- | --- | --- | --- |
| App | `http://localhost:5173` | Vercel preview URL | production domain |
| Supabase | dev/staging project | dev/staging project | production project |
| Redirect URLs | localhost:5173 | `*-your-team.vercel.app` | production domain |

## 4. Admin provisioning (spec §17)

There is **no public path to an admin role**. The signup trigger forces
`role = 'client'`. To create an admin:

```sql
-- 1. Register the account normally (or create the auth user in the dashboard)
-- 2. Then, as the service role / SQL editor:
update public.profiles set role = 'admin' where email = 'operator@northforge.studio';
-- super admin:
update public.profiles set role = 'super_admin' where email = 'owner@northforge.studio';
```

Optionally link the admin to a client workspace with `client_id`, or leave it
`null` — admins bypass client scoping.

## 5. The mandatory isolation test (spec §65, §66)

Register two clients (A and B) and one admin, then verify:

- [ ] Client A sees only their own leads/requests/invoices/analytics
- [ ] Client A cannot read Client B's rows (even by guessing IDs — RLS returns empty/denied, never the data)
- [ ] Client A cannot update another client's records (policies reject, error maps to "You don't have permission…")
- [ ] Client A cannot list or download Client B's files (signed URL creation for another client's path is denied)
- [ ] Client A does not receive announcements addressed to Client B or unpublished announcements
- [ ] Client A's notification preferences are their own — toggles never affect Client B
- [ ] Client A hitting `/app` lands on `/unauthorized`
- [ ] Client A calling admin-only tables gets empty results / denials
- [ ] Admin can read/manage authorized business data
- [ ] Signed-out visitor sees only public pages; direct `/portal`, `/app` hits redirect to `/login`

This is enforced by RLS in Postgres — the React guards are UX only.

## 6. Deployment verification (spec §76–§78)

A deployment counts as successful only after **all** of these pass on the
deployed URL — a green Vercel build alone is not success:

1. Build: `npm run typecheck && npm run lint && npm test && npm run build`
2. Login → correct portal/admin redirect; logout → public site
3. Reload while signed in → session persists (no login flash loop)
4. Direct URL navigation works (`/login`, `/portal`, `/app/clients` — SPA rewrite in `vercel.json`)
5. Forgot password → email link → `/reset-password` → new password → login
6. Signup → confirmation email → login (with email confirmation enabled)
7. Client isolation test above
8. Contact form submission → row appears in `enquiries`
9. Browser console free of uncaught errors; no secrets in the bundle
   (check the built JS for `SUPABASE_SECRET` / `service_role` — there must be
   no match)

## 7. Architecture notes

- **One Supabase client** (`src/lib/supabase.ts`), PKCE flow, persisted and
  auto-refreshed sessions. A missing config reports `ConfigError`
  (→ "NorthForge is not configured…") instead of a misleading login failure.
- **One session listener** (`AuthProvider`). Callbacks are deferred with
  `setTimeout(0)` because supabase-js invokes them while holding its internal
  auth lock — calling `getSession()` synchronously there deadlocks the app.
- **Error translation** (`src/lib/auth-errors.ts`, `src/services/db.ts`):
  raw PostgREST/Supabase errors never reach users; developer codes
  (`AUTH_INVALID_CREDENTIALS`, …) are logged without secrets.
- **AI is intentionally not implemented** (spec §79–§80): the
  `ai_assistants` / `ai_conversations` / `ai_messages` tables and RLS exist as
  a clean extension point, with no exposed UI.
