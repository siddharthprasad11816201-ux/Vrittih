# Vrittih — Production Readiness

The app is functionally complete and clean (no stubs/mocks). This is the checklist
to take it from "runs on one laptop" to "handles 1 lakh+ users." Items marked
**[code fixed]** are already done; **[needs your infra]** requires a resource only you can provide.

## 1. Database → Postgres  **[needs your infra]**
SQLite (the current dev DB) is single-writer and file-locked — it will not survive
real concurrency. `pg` is already installed.
- In `prisma/schema.prisma` change `provider = "sqlite"` → `provider = "postgresql"`.
- Set `DATABASE_URL="postgresql://user:pass@host:5432/vrittih"`.
- Run `npx prisma migrate deploy` (or `prisma db push`) against the Postgres instance.
- JSON is stored in `String` columns (portable); optionally switch hot ones to `Jsonb` later.
Managed options: Supabase, Neon, RDS, Railway.

## 2. Payments → Stripe (CHF)  **[needs your infra]**
Razorpay is an India/INR gateway and **does not settle CHF** — live 1 CHF charges fail.
Switzerland/CHF needs **Stripe** (or Wallee/Datatrans locally). The gateway is pluggable
(`lib/payment.ts`, `ACTIVE_PAYMENT_GATEWAY`) — swap the Razorpay client for a Stripe one
and keep `currency: "CHF"`. Provide `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`.

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
