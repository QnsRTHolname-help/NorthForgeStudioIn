# Deploying NorthForge

One Node process serves both the API and the built frontend. There is no separate web server, no sidecar and no build step on the host — the image arrives ready to run.

```
                 ┌──────────────────────────────┐
   browser  ───► │  Express (node dist-server)  │
                 │  /api/*  → JSON              │
                 │  /*      → dist/ SPA         │
                 │  /health → liveness          │
                 └──────────┬───────────────────┘
                            │
                     SQLite file on a volume
```

---

## 1. What you need before deploying

| Variable | Required | Notes |
| --- | --- | --- |
| `JWT_SECRET` | **yes** | ≥ 32 chars. `openssl rand -hex 48`. Rotating it signs out every user. |
| `CLIENT_ORIGIN` | **yes** | Comma-separated origins allowed to call the API, e.g. `https://northforge.studio` |
| `DATABASE_FILE` | yes | Path to the SQLite file. Keep it **on a volume** — losing it loses the business. |
| `PORT` | no | Defaults to `4000`. |
| `BCRYPT_ROUNDS` | no | `10` in dev; `12` is a reasonable production value. |
| `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_VERIFY_TOKEN` | no | Without these, messages are recorded locally instead of sent. |
| `SITE_URL` | no | Used for `sitemap.xml` and canonical URLs. Defaults to `https://northforgestudio.vercel.app`. |
| `VITE_API_URL` | no | Frontend-only. Set when the site and API are deployed **separately** (see §6). Leave unset when one process serves both. |

Copy `.env.example` to `.env`, fill it in, and never commit `.env`.

---

## 2. Docker (recommended)

```bash
docker compose up --build          # build + run on :4000
docker compose run --rm seed       # seed the admin + demo accounts (first run)
```

- The database lives on the `northforge-data` volume.
- The container runs as a non-root user.
- `HEALTHCHECK` hits `/health`, which probes the database and returns `503` if it is unreachable.

### Seeding

```bash
npm run seed          # idempotent — safe to re-run
npm run seed:demo     # demo rows only
npm run seed:clean    # remove seeded demo rows (keeps real data)
```

---

## 3. Without Docker

```bash
npm ci
npm run build         # tsc -b && vite build && sitemap
npm run build:server  # esbuild → dist-server/index.js
npm run seed
NODE_ENV=production JWT_SECRET=… CLIENT_ORIGIN=https://… node dist-server/index.js
```

Run it behind systemd, pm2 or any process supervisor. It is stateless apart from the SQLite file.

---

## 4. Reverse proxy

Terminate TLS at nginx/Caddy and forward to `127.0.0.1:4000`. Two things matter:

```nginx
location / {
  proxy_pass http://127.0.0.1:4000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# Never cache the entry document; assets are fingerprinted and cached by the app.
location = /index.html { add_header Cache-Control "no-store"; }
```

`app.set('trust proxy', 1)` is already enabled, so `X-Forwarded-Proto` is respected for secure cookies.

---

## 5. Backups

SQLite, so backups are a file copy — but copy it **safely**:

```bash
sqlite3 /app/data/northforge.db ".backup /backups/northforge-$(date +%F).db"
```

Do not `cp` a live database file; the WAL means a plain copy can be inconsistent. Schedule the `.backup` command nightly and ship the result off-host.

---

## 6. After deploying

- `GET /health` → `{"ok":true,"data":{"state":"operational",...}}`
- Sign in, open **System health** in the admin OS, and run a re-check — every component reports a real probe result.
- Confirm `robots.txt` and `sitemap.xml` are served, and that `SITE_URL` matches your real domain.

---

## 7. Moving to Postgres

`server/src/schema.sql` holds the Postgres/Supabase schema (the SQLite equivalent is `server/src/schema.ts`). The data layer is centralised in `server/src/db.ts`, so the migration is: create the schema from the SQL file, swap the driver, and keep the money convention — **integer paise**, never floats.


---

## 6. Deploying the site to Vercel

**The frontend alone cannot authenticate users.** Login posts to `/api/auth/login`.
If no API is deployed there, Vercel answers with the HTML shell, the browser
fails to parse it as JSON, and signing in appears to do nothing (or signs you
straight back out). This is the single most common deployment mistake with
this codebase.

Pick one of two layouts:

### A. One host (recommended — simplest, no CORS, no cookie issues)

Run the Docker image on any host (Render, Railway, Fly.io, a VPS, your own
machine behind a tunnel). The same process serves the site and the API, so
both live on one origin. Nothing else to configure.

### B. Site on Vercel, API elsewhere

1. Deploy the API host first and note its URL, e.g. `https://api.yourdomain.com`.
2. Add `CLIENT_ORIGIN=https://northforgestudio.vercel.app` to the **API's** env.
3. Add `VITE_API_URL=https://api.yourdomain.com` to the **Vercel** project's
   environment variables, then redeploy (Vite inlines it at build time).
4. `vercel.json` in this repo already rewrites every non-`/api` path to
   `index.html`, so `/login`, `/portal/*` and `/app/*` survive a hard refresh.

> Sessions work in both layouts. The API returns a signed bearer token with
> login, which the frontend sends on every request — so even when a browser
> blocks third-party cookies (embedded previews, some in-app browsers), the
> session holds.

### Verifying a deployment

```bash
curl https://your-api-host/health                 # expect {"ok":true,...}
curl -X POST https://your-api-host/api/auth/login \
  -H 'content-type: application/json' -H 'x-nf-client: 1' \
  -d '{"email":"owner@northforge.studio","password":"NorthForge@2026"}'
```

If the second command returns HTML instead of JSON, the API is not deployed at
that address — the frontend is talking to a static host.
