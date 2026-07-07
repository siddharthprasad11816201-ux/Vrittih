# Deploy Vrittih to Vercel + Neon (with vrittih.online)

Follow these in order. The **core product goes fully live**. Live chat + video
interviews need a small realtime host (Railway/Render) added later — everything
else works on Vercel.

---

## 1) Database — Vercel Postgres (no separate signup)
Serverless can't use SQLite, so you need a hosted Postgres. The simplest is Vercel's
own — created inside the dashboard you already use.
1. Import the repo to Vercel first (step 2), then in the **project → Storage tab →
   Create Database → Postgres**. Vercel provisions it and auto-injects the connection
   env vars into the project. (Any Postgres works — Supabase, Railway, etc. — if you
   prefer.)
2. Copy the connection string it shows (use the **non-pooled / direct** one if offered).
3. Locally, set just this one line in `.env` (paste your string):
   ```
   DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
   ```
4. Create the tables + super admin:
   ```
   npx prisma db push
   node prisma/seed-admin.mjs
   ```
   (Optional: seed demo jobs, then re-import your Indeed CSV via `/admin/import` after go-live.)

## 2) Deploy the app — Vercel
1. **vercel.com → Add New → Project → Import** the `Vrittih` GitHub repo. Framework
   auto-detects as **Next.js**. (Build command stays `npm run build`; it runs
   `prisma generate` automatically.)
2. **Environment Variables** — add every one of these (Production + Preview):
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Postgres connection string (auto-set if you use Vercel Postgres) |
   | `JWT_SECRET` | long random (`openssl rand -hex 48`) |
   | `JWT_EXPIRY` | `7d` |
   | `FACE_VECTOR_KEY` | exactly 32 chars |
   | `NEXT_PUBLIC_APP_URL` | `https://vrittih.online` |
   | `APP_URL` | `https://vrittih.online` |
   | `NODE_ENV` | `production` |
   | `ACTIVE_PAYMENT_GATEWAY` | `razorpay` |
   | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | your Razorpay keys |
   | `SMTP_HOST/PORT/USER/PASS`, `MAIL_EHLO` | if sending email |
   | `CRON_SECRET` | long random (protects the worker cron) |
   | `SUPERADMIN_EMAIL/PASSWORD/NAME` | for re-seeding |
3. Click **Deploy**. You'll get a `*.vercel.app` URL — verify it loads and you can
   sign in as the super admin.

## 3) Domain — vrittih.online
1. Vercel project → **Settings → Domains → Add** `vrittih.online` **and** `www.vrittih.online`.
2. Vercel shows the exact DNS records. At your registrar's DNS, add what it lists — typically:
   - `vrittih.online` → **A** record → `76.76.21.21`
   - `www` → **CNAME** → `cname.vercel-dns.com`
   (Use the exact values Vercel displays — they can change.)
3. Wait for the green "Valid" check. HTTPS is issued automatically.

## 4) Payments live
- Switch Razorpay to **live keys** (`rzp_live_…`) in Vercel env.
- In the Razorpay dashboard, enable **International Payments** so non-INR currencies clear.

## 5) The two follow-ups (optional, add anytime)
- **Live chat + interviews:** deploy `server/chat.js` (:3001) and `server/signal.js`
  (:3002) on **Railway/Render** behind TLS, then set `NEXT_PUBLIC_WS_URL=wss://…`
  and `NEXT_PUBLIC_SIGNAL_URL=https://…` in Vercel. Everything else already works.
- **Near-real-time background jobs:** the built-in `vercel.json` cron runs hourly.
  For per-minute processing on the Hobby plan, add a free external cron
  (cron-job.org) hitting `https://vrittih.online/api/cron/worker` with header
  `Authorization: Bearer <CRON_SECRET>`.

## Data note
Neon starts empty — your local SQLite data does **not** transfer. Re-seed the admin
(step 1.4) and re-import candidates via `/admin/import`. Local dev now uses the same
Neon DB (or spin up a separate Neon branch for dev).
