# NorthForge — Supabase & Vercel Production Setup

The backend is **Supabase**: Supabase Auth owns credentials, `profiles` owns
application identity (role + client linkage), and Row Level Security on every
table is the real security boundary. The frontend talks to Supabase directly
through one client (`src/lib/supabase.ts`) and one service layer
(`src/services/index.ts`).

## 1. Database — run the migration

In the Supabase dashboard (SQL Editor) or via the CLI, run:

```
supabase/migrations/0001_northforge_supabase.sql
```

It is **non-destructive**: only `CREATE` / `CREATE OR REPLACE` /
`drop policy if exists` statements. Safe to re-run; no tables are dropped.
It provisions:

- `clients`, `profiles` (id = `auth.users.id`), and every business table
- the `handle_new_user` signup trigger — public signup can **only** create
  role `client`, no matter what metadata the browser sends
- `guard_profile_update` — a non-admin can never change their own
  `role` / `client_id`
- RLS enabled on every table with explicit policies
  (admin = all; client = own rows only; enquiries = public insert, admin read)

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
