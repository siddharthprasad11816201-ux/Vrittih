# Deploying Vrittih

## The one thing to understand first

Your **laptop runs on SQLite** (the local `dev.db`) and should stay that way — keep
coding, no setup needed. **Production runs on Postgres.** You only switch to Postgres
once you have a Postgres database URL. Running the Postgres commands on your laptop
without that URL is what fails — the tooling now refuses it so you can't get stuck.

> You are on Windows PowerShell. Chain commands with `;` — **`&&` does not work**.
> Run each command on its own line, or join with `;` (e.g. `npm run build; npm start`).

---

## Step 1 — Create a Postgres database (once)

Easiest free option: **[neon.tech](https://neon.tech)** → sign up → **Create project** →
copy the connection string. It looks like:

```
postgresql://user:password@ep-xxxx.aws.neon.tech/neondb?sslmode=require
```

(Railway and Supabase also work — any Postgres URL is fine.)

---

## Step 2 — Set your environment variables

Open `.env.production.example` — it lists every variable with `[REQUIRED]`/`[optional]`.
The must-haves:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Postgres string from Step 1 |
| `JWT_SECRET` | a long random secret — generate: `openssl rand -hex 48` |
| `FACE_VECTOR_KEY` | exactly 32 characters |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | your real admin login (not `change-me`) |
| `ACTIVE_PAYMENT_GATEWAY` | `razorpay` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` | from dashboard.razorpay.com |
| `NODE_ENV` | `production` |

---

## Step 3 — Pick a path

### Path A — Deploy on a host (recommended: Railway / Render)

Your laptop stays on SQLite; the host runs Postgres. Nothing to flip locally.

1. Push is already done — the repo is on GitHub.
2. On **railway.app** (or render.com): **New Project → Deploy from GitHub repo**, pick this repo.
3. In the service's **Variables**, paste the env vars from Step 2 (real values).
4. Set the commands:
   - **Build:** `npm run build`
   - **Release / pre-deploy:** `npm run deploy:db:full`  ← flips to Postgres, creates the schema, seeds the admin + 437 jobs + company pages
   - **Start:** `npm start`
5. Deploy. Visit the URL, sign in with your `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`.

### Path B — Run production locally against the cloud Postgres

Use this to test the production build from your machine.

```powershell
# 1. Put the Neon URL + the Step-2 vars into .env  (DATABASE_URL = the postgres:// string)
# 2. One command sets up the database on Postgres:
npm run deploy:db:full
# 3. Build, then start (note the ';', not '&&'):
npm run build; npm start
```

When you want to go back to local SQLite development:

```powershell
npm run db:sqlite
# ...and set DATABASE_URL back to "file:./dev.db" in .env
```

---

## What `deploy:db` does (and its safety)

`npm run deploy:db` (schema + admin) or `npm run deploy:db:full` (+ jobs + company pages):
1. **Checks `DATABASE_URL` is Postgres before changing anything** — aborts cleanly if not, so the schema is never left half-flipped.
2. Warns if `JWT_SECRET` / `SUPERADMIN_PASSWORD` / `FACE_VECTOR_KEY` are still placeholders.
3. Flips the provider → `prisma db push` → seeds the super admin → (full) imports jobs + backfills company pages.

If you ever see `P1012 … url must start with postgresql://`, it means `DATABASE_URL`
isn't set to Postgres yet — do Step 1/2 first, or run `npm run db:sqlite` to keep developing.

---

## Optional services

- **Live chat + video interviews:** run `node server/chat.js` (port 3001) and
  `node server/signal.js` (port 3002), and set `NEXT_PUBLIC_WS_URL` / `NEXT_PUBLIC_SIGNAL_URL`.
  The rest of the app works without them.
- **Background worker** (email/notifications queue): `node server/worker.js` with `WORKER_SECRET` set.
- **Outbound email:** set the `SMTP_*` vars.
