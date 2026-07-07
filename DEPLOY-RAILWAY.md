# Deploy Vrittih on Railway (recommended — runs the whole app + Postgres)

Railway runs a normal Node server, so **everything works**: the web app, the
database, and (optionally) the chat/interview/worker processes — all in one place.

> **Before deploying — one line:** local dev uses SQLite. In `prisma/schema.prisma`
> change `provider = "sqlite"` → `provider = "postgresql"`, commit, push. (The `url`
> is already env-driven — you only touch that one word. Tell me and I'll do it for you.)

---

## 1) Deploy the app
1. Go to **railway.app** → **Login with GitHub**.
2. **New Project → Deploy from GitHub repo → select `Vrittih`.**
3. Railway auto-detects Next.js and starts building. (First build may error until the
   database exists — that's expected; continue.)

## 2) Add the database (one click, inside Railway)
1. In the project, click **New → Database → PostgreSQL**. Railway creates it.
2. Open your **web service → Variables → New Variable →** add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`  (Railway autocompletes this reference)

## 3) Add the rest of the env vars (web service → Variables)
| Key | Value |
|---|---|
| `JWT_SECRET` | long random (`openssl rand -hex 48`) |
| `JWT_EXPIRY` | `7d` |
| `FACE_VECTOR_KEY` | exactly 32 chars |
| `NEXT_PUBLIC_APP_URL` | `https://vrittih.online` |
| `APP_URL` | `https://vrittih.online` |
| `NODE_ENV` | `production` |
| `ACTIVE_PAYMENT_GATEWAY` | `razorpay` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | your keys |
| `WORKER_SECRET`, `CRON_SECRET` | long random |
| `SUPERADMIN_EMAIL/PASSWORD/NAME` | for re-seeding |

## 4) Create the tables + super admin
1. In Railway: **Postgres service → Connect →** copy the **Postgres Connection URL**.
2. Locally, put it in `.env` as `DATABASE_URL="…"`, then run:
   ```
   npx prisma db push
   node prisma/seed-admin.mjs
   ```
3. Back in Railway, **Redeploy** the web service. Open the `*.up.railway.app` URL and
   sign in as the super admin — you're live.

## 5) Domain — vrittih.online (GoDaddy)
1. Web service → **Settings → Networking → Custom Domain →** add `www.vrittih.online`.
   Railway shows a **CNAME target** (e.g. `xxxx.up.railway.app`).
2. In GoDaddy DNS → **Add New Record**: type **CNAME**, name **www**, value =
   the Railway target.
3. For the bare `vrittih.online`: GoDaddy → **Forwarding** → forward `vrittih.online`
   → `https://www.vrittih.online` (permanent). (GoDaddy can't CNAME an apex; forwarding
   is the clean fix. Or move DNS to Cloudflare for apex flattening.)

## 6) (Optional) turn on live chat + interviews + worker
Railway can run the extra processes as separate services (Vercel couldn't):
- **New → Empty Service → same repo**, set **Start Command** to `node server/chat.js`
  → note its public URL → set `NEXT_PUBLIC_WS_URL=wss://<that host>` on the web service.
- Repeat with `node server/signal.js` → `NEXT_PUBLIC_SIGNAL_URL=https://<that host>`.
- Repeat with `node server/worker.js` for always-on background jobs (or keep the
  `/api/cron/worker` route + a Railway cron).

---

### Free alternative: Render
render.com works the same way — **New → Web Service** (from GitHub, build `npm run build`,
start `npm start`) **+ New → PostgreSQL**. Free tier sleeps on idle; fine for a pilot.
