# Deploy Vrittih to Vercel + Neon (with vrittih.online)

Follow these in order. The **core product goes fully live**. Live chat + video
interviews need a small realtime host (Railway/Render) added later — everything
else works on Vercel.

---

## 1) Database — Neon Postgres (free)
1. Sign up at **neon.tech** → **Create project** (region close to your users).
2. On the project dashboard, open **Connection Details**. You need **two** strings:
   - **Pooled** connection (host contains `-pooler`) → this is `DATABASE_URL`
   - **Direct** connection (toggle "Pooled connection" **off**) → this is `DIRECT_URL`
   Both should end with `?sslmode=require`.
3. Locally, put both in `.env`:
   ```
   DATABASE_URL="postgresql://…-pooler…/neondb?sslmode=require"
   DIRECT_URL="postgresql://…(direct)…/neondb?sslmode=require"
   ```
4. Create the tables + super admin in Neon:
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
   | `DATABASE_URL` | Neon **pooled** string |
   | `DIRECT_URL` | Neon **direct** string |
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
