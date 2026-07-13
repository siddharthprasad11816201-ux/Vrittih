# Vrittih — Production Readiness

The app is functionally complete and clean (no stubs/mocks). This is the checklist
to take it from "runs on one laptop" to "handles 1 lakh+ users." Items marked
**[code fixed]** are already done; **[needs your infra]** requires a resource only you can provide.

## 1. Database → Postgres  **[code fixed + needs your infra]**
SQLite (the current dev DB) is single-writer and file-locked — it will not survive
real concurrency. `pg` is already installed. The whole app is now Postgres-portable:
- **[code fixed]** Case-insensitive search: SQLite `LIKE` is case-insensitive but
  Postgres `LIKE` is case-sensitive. `lib/db.ts` `ci()` adds `mode:"insensitive"`
  automatically when `DATABASE_URL` is Postgres, so search keeps working. Used by
  every search endpoint (jobs, companies, people, admin, CRM, mail).
- **[code fixed]** No SQLite-only features remain (no `skipDuplicates`, no raw SQL);
  `Bytes` media and `String`-JSON columns are portable to Postgres.
- Flip the provider: **`npm run db:postgres`** (reversible with `npm run db:sqlite`).
- Set `DATABASE_URL="postgresql://user:pass@host/vrittih?sslmode=require"`.
- `npx prisma db push` to create the schema, then `npm run seed:admin`
  (+ `seed:companies` after any job import).
Managed options: Neon, Supabase, Railway, RDS.

## 2. Payments → Razorpay (CHF display, pay in home currency)  **[built — needs your keys]**
**Done in code:** Razorpay Orders + client Checkout (`lib/razorpay.ts`), a **live-FX**
engine using ECB reference rates (`lib/fx.ts`), and `/pay` + `/pricing` where the price
shows as **CHF** but the customer **pays in their own currency at the live rate** (cards,
UPI, wallets — works across regions). Routes: `create-order`, `verify` (signature-checked),
`rates`. Payment attaches to the **real signed-in user** (the old `temp_user_id` bug is gone).
The admin **Gateway** panel (`/admin/gateway`) reflects real env-configured connection state
and persists the active gateway. Stripe has been removed (it was unused).
**You provide:** `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (and `NEXT_PUBLIC_RAZORPAY_KEY_ID`),
and `ACTIVE_PAYMENT_GATEWAY=razorpay`. For live card capture in Europe, enable international
cards on your Razorpay account (or add a region-appropriate gateway later — the panel supports
switching once its keys are set).

## 3. Realtime chat & interviews  **[code fixed + needs hosting]**
- Client URLs are now env-driven: set `NEXT_PUBLIC_WS_URL=wss://…` (chat) and
  `NEXT_PUBLIC_SIGNAL_URL=https://…` (WebRTC signaling). **[code fixed]**
- `server/chat.js` (:3001) and `server/signal.js` (:3002) are **separate processes** —
  run them with a process manager (pm2/systemd) or containers, behind TLS (`wss://`).
- For **multiple app instances**, the in-memory WS connection maps must be backed by a
  **Redis pub/sub adapter** so messages fan out across nodes.

## 4. Rate limiting at scale  **[code hardened + needs Redis for multi-instance]**
The in-memory limiter now evicts expired keys and hard-caps memory **[code fixed]**, but
it is per-instance. Behind a load balancer, back it with **Redis** (the `checkRateLimit`
signature is a drop-in). Same for any per-instance caches.

## 5. WebRTC TURN server  **[needs your infra]**
Interviews currently use Google's public STUN only — ~10–20% of users behind strict NATs
will fail to connect. Add a **TURN server** (coturn) and list it in `ICE_SERVERS`.

## 6. Background worker  **[needs process manager]**
`server/worker.js` runs the DB-backed job queue (emails, notifications). Run it as a
persistent process in prod. Locally, `npm run dev:all` starts app + chat + signal + worker
together (plain `npm run dev` runs only the web app).

## Already fixed in code this pass
- Realtime URLs env-driven with `wss://` support (no more hardcoded localhost).
- `/api/applications` paginated + capped (no unbounded full-table load).
- Rate-limiter eviction + hard cap (no memory leak).
- Currency defaults to **CHF** on job posting (was INR).
- Removed dead `multer` dependency; renamed the `edurankai` face-key fallback to `vrittih`.

## Still third-party by nature (acceptable)
`react`, `next`, `prisma`, `pg` (framework/driver), `face-api.js` + `tesseract.js` (ML
models — not feasible to rebuild), and the payment PSP. `socket.io` powers interview
signaling (chat is already in-house `ws`) — can be migrated to in-house `ws` later.
