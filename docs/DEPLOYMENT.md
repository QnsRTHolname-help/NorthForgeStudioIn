# Deploying NorthForge

There is **one** runtime and **one** backend:

```
                              ┌──────────────────────────────────┐
   browser ──── static ─────► │ Vercel: the built SPA (dist/)     │
       │                      │ vercel.json: rewrites + headers   │
       │                      └──────────────────────────────────┘
       │
       └── Supabase JS (publishable key) ──► Supabase
                                              • Postgres + RLS (the boundary)
                                              • Auth (sessions, TOTP MFA)
                                              • Storage (private bucket)
                                              • Edge Functions (WhatsApp)
```

There is no application server, no `/api` route and no Docker image. The
browser talks to Supabase directly with the publishable (anon) key; every
table is protected by Row Level Security, so that key says *who you are* and
never *what you may read*. An earlier Express + SQLite server and its Docker
setup were **removed** — nothing in `src/` referenced them, and keeping a
second, unused backend in the tree was a standing invitation to deploy the
wrong one.

---

## 1. Environment variables

Vite exposes **only** `VITE_`-prefixed variables to the browser. That prefix is
the entire secrets boundary: the Supabase secret/service-role key must never
be given a `VITE_` name.

| Variable | Where | Required | Notes |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Vercel (all envs) | **yes** | Project URL. |
| `VITE_SUPABASE_ANON_KEY` | Vercel (all envs) | **yes** | Publishable/anon key. Safe to ship — RLS is the boundary. |
| `VITE_SITE_URL` | Vercel | **yes** | Canonical + OpenGraph base. Must match the production domain. |
| `VITE_WHATSAPP_NUMBER` | Vercel | **yes** | Digits only, country code first. |
| `VITE_GA4_ID` | Vercel | no | `G-XXXXXXXXXX`. Unset ⇒ no analytics script is requested at all. |
| `VITE_GOOGLE_SITE_VERIFICATION` | Vercel | no | Search Console verification token. |
| `WHATSAPP_ACCESS_TOKEN` | Supabase secrets | no | Cloud API sending. |
| `WHATSAPP_PHONE_NUMBER_ID` | Supabase secrets | no | Cloud API sending + webhook filtering. |
| `WHATSAPP_VERIFY_TOKEN` | Supabase secrets | no | Meta webhook subscription check. |
| `WHATSAPP_APP_SECRET` | Supabase secrets | **yes for the webhook** | Meta App Secret. The webhook verifies `X-Hub-Signature-256` with it and **refuses every event while it is unset**. |

Vite inlines env values at **build** time. Changing one requires a redeploy —
not just an env edit.

---

## 2. Deploying

```bash
npm ci
npm run build      # tsc --noEmit && vite build && generate sitemap + robots
```

Vercel runs exactly that (`vercel.json` → `buildCommand`), serves `dist/`, and
applies the rewrites and headers described below. Push to `main` and Vercel
deploys.

### Database migrations

Migrations live in `supabase/migrations/` and are applied **in order**. They
are written to be safe to re-run. Either paste them into the Supabase SQL
editor, or use the CLI:

```bash
npx supabase link --project-ref <ref>
npx supabase migration list
npx supabase db push --dry-run     # always look before you leap
npx supabase db push
```

If earlier migrations were applied by pasting SQL, the CLI's history table is
empty and `db push` will try to replay everything. Tell it what is already
done first:

```bash
npx supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013
npx supabase db push
```

### Edge Functions

```bash
npx supabase functions deploy whatsapp-send
npx supabase functions deploy whatsapp-webhook --no-verify-jwt
```

`whatsapp-webhook` is `--no-verify-jwt` because Meta cannot present a Supabase
session. It is therefore protected by Meta's own request signature instead —
see `docs/WHATSAPP_SETUP.md`. Both functions import their pure logic from
`supabase/functions/_shared/whatsapp-edge.ts`, which is unit-tested by
`npm test`.

---

## 3. Security headers (`vercel.json`)

| Header | Value / intent |
| --- | --- |
| `Content-Security-Policy` | Written against this bundle, not copied. `script-src` has **no** `'unsafe-inline'`: the theme bootstrap is an external file, and the JSON-LD blocks are *data blocks* that `script-src` does not apply to. |
| `script-src-attr 'none'` | Blocks inline event-handler attributes. This is why `index.html` no longer uses the `media="print" onload="…"` async-CSS trick for Google Fonts — a blocked handler would have left the fonts unloaded. |
| `style-src 'self' 'unsafe-inline' …` | **Deliberately relaxed.** Style is set imperatively in many places and injected style is not script execution. Removing it needs a per-component audit. |
| `connect-src` / `img-src` | `https://*.supabase.co` (wildcard, so the header stays correct if the project ref changes), plus the only two third parties actually integrated: GA4 and the TOTP QR renderer. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` | The dashboard is never framed. |
| `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `X-Permitted-Cross-Domain-Policies`, `X-Content-Type-Options` | Standard hardening; all features the app does not use are denied. |

**After changing the header list, verify a real deploy** — a CSP that breaks
the app fails loudly in the browser console, not at build time.

---

## 4. Routing

`vercel.json` rewrites every path that is not a real file (no dot) and not
under `/assets` to `index.html`, so `/login`, `/portal/*` and `/app/*` survive
a hard refresh. `/sitemap.xml`, `/robots.txt`, `/og.png` and hashed assets
still resolve to their static files.

Route guards are **UX only**. Direct URL entry is not the boundary: RLS decides
what each session can actually read or write, whatever the router renders.

---

## 5. Post-deploy checks

- Sign in, then open **System health** in the admin OS.
- Confirm `/robots.txt` and `/sitemap.xml` are served.
- Approve analytics in the consent banner, then confirm the GA4 script is
  requested **only** after that choice.
- An admin account with MFA enrolled must complete the second factor before any
  admin page renders data (see migration 0008/0010/0014).
- Account deletion must complete (migration 0014 fixed the storage column that
  made it fail on every attempt).

---

## 6. Data protection

Supabase holds the database and private storage; there is no local data
directory. Use Supabase's own backup/PITR settings, and follow
`docs/PRIVACY_DATA_AND_LAUNCH.md` for the retention story — invoices and
payments are **retained** (detached, not deleted) when an account closes, so
"deleted" never means "the accounting record is gone".
