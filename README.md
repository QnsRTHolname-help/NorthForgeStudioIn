# NorthForge

NorthForge is a **web · automation · AI · growth** studio platform: one
codebase containing the public marketing site, a secure client portal, and the
internal agency operating system — all backed by **Supabase**.

Three visual personalities share one design token set: **public = premium
editorial**, **portal = premium SaaS**, **admin = dense command center**.

---

## Stack

- **Frontend** — React 18, TypeScript (strict), Vite, Tailwind, GSAP + Lenis,
  hand-rolled SVG charts, React Router with per-route code splitting.
- **Backend** — **Supabase**: Auth (email + password, PKCE) is the source of
  truth for credentials; `profiles` holds role + client linkage; **Row Level
  Security** on every table is the real security boundary.
- **Shared** — `shared/catalog.ts` is the single source of truth for pricing;
  `shared/types.ts` is the client↔app contract.

## Architecture

```
UI components  →  hooks (useAsync / useMutation)  →  services  →  Supabase
```

Components never touch the Supabase client. **Authorization is enforced by
RLS in Postgres on every query** — frontend route guards are UX only. A
client querying another business's data gets denied by the database, not an
empty list, and public signup can only ever create role `client` (the signup
trigger forces it server-side).

## Running it

```bash
npm install
npm run dev          # Vite on :5173
```

| | |
| --- | --- |
| App | `http://localhost:5173` |
| DB migration | run `supabase/migrations/0001_northforge_supabase.sql` once (non-destructive, safe to re-run) |
| Setup guide | [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) |

Environment: copy `.env.example` → `.env` and set
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (public, bundled) and any
optional server-side values. **Vercel:** set the variables per environment
(Production / Preview / Development) and redeploy after changing them.

### Accounts

There is no seeded login. Register a real client account at `/register`, then
grant admin from the Supabase SQL editor (see the setup guide — public signup
can never self-assign a privileged role):

```sql
update public.profiles set role = 'admin' where email = 'operator@example.com';
```

## Scripts

```bash
npm run dev          # dev server
npm run build        # typecheck + production bundle + sitemap
npm run typecheck    # tsc --noEmit
npm run lint         # eslint, zero warnings
npm test             # unit + API integration tests
```

## What is real vs. not

| Area | State |
| --- | --- |
| Auth, roles, isolation | Real — Supabase Auth + RLS; role changes and ownership enforced server-side |
| Clients, leads, projects, tasks, websites | Real CRUD, RLS-scoped |
| Billing, invoices, subscriptions | Real records; amounts in **paise** integers, formatted only at the edge |
| Catalog/pricing | Static, versioned — one source of truth, browser never invents a price |
| WhatsApp | Real records; Cloud API sending only with server-side provider credentials (env-only) |
| Payments | Recorded; no gateway wired |
| AI | **Intentionally not implemented** — schema + RLS exist as an extension point; no fake chatbot |

**No fabricated business data.** Empty dashboards show empty states, never
invented numbers.

## Before going live

1. Run the migration on the production Supabase project.
2. Configure Auth: Site URL + redirect URLs (production domain, Vercel
   preview wildcard, localhost) — see the setup guide.
3. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` on Vercel for
   Production **and** Preview, then redeploy.
4. Provision admins via SQL only.
5. Run the mandatory client-isolation test (setup guide §5).
6. Review `src/data/site.ts` (business details) and `src/pages/public/Legal.tsx` (template, not legal advice).
