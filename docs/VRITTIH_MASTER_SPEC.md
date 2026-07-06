# Vrittih — Master Engineering Specification

**Product:** Vrittih (`vrittih.online`)
**Version:** 1.0
**Status:** Implementation-ready · single source of truth
**Repository:** `edurankai-jobs` (folder name legacy; product is Vrittih)
**Audience:** Senior engineers · Claude Code (VS Code)

> **Legend used throughout**
> `✅ BUILT` — implemented and verified in this repository.
> `◑ PARTIAL` — implemented but not to full spec depth.
> `○ PLANNED` — specified here for build; not yet implemented.
> Every requirement below is authoritative. Where multiple interpretations exist, the chosen one is stated as an **Assumption**.

---

## Table of contents

1. [Product Vision](#1-product-vision)
2. [Functional Requirements](#2-functional-requirements)
3. [Complete User Experience](#3-complete-user-experience)
4. [Business Logic](#4-business-logic)
5. [Database Design](#5-database-design)
6. [Backend Architecture](#6-backend-architecture)
7. [Frontend Architecture](#7-frontend-architecture)
8. [APIs](#8-apis)
9. [Security](#9-security)
10. [Performance](#10-performance)
11. [Notifications](#11-notifications)
12. [Analytics](#12-analytics)
13. [Integrations](#13-integrations)
14. [Deployment](#14-deployment)
15. [Testing](#15-testing)
16. [Documentation](#16-documentation)
17. [Future Scalability](#17-future-scalability)
18. [Final Product Definition](#18-final-product-definition)
19. [Assumptions Register](#19-assumptions-register)

---

## 1. Product Vision

### 1.1 Purpose
Vrittih is a **single unified workspace** that merges two products into one: (a) an **all-in-one hiring & job-search platform** (find work, apply, interview, test, get hired — with live status at every stage), and (b) a **WhatsApp-familiar CRM & communication suite** (contacts, pipeline, chat-is-CRM, forms, custom-domain mail). One account, one design language, one bill.

### 1.2 Mission
Give every job-seeker, employer, and small business **one place** to hold every relationship, conversation, application, and transaction — with the ease of consumer chat and the depth of professional tooling, **built entirely in-house** so the platform can be owned outright (patent / IP-clean).

### 1.3 Objectives
- Zero tool-switching: jobs, CRM, chat, mail, interviews, tests, forms, payments co-located.
- **Everything in-house, no third-party runtime libraries** for core capability (auth, 2FA, passkeys, DKIM, QR, matching, realtime) — a hard product constraint for patentability.
- Real-time application status from first click to offer letter.
- India-first economics but **CHF as the platform currency** (joining fee `1 CHF`).
- Grow customer-funded: one-time `1 CHF` join, no subscriptions.

### 1.4 Problems solved
| Problem | Vrittih's answer |
|---|---|
| Applicants never know where they stand | Live per-stage status + read-depth on messages |
| Hiring tools are fragmented (ATS + Zoom + forms + chat) | All native, one product |
| CRMs are heavy and bureaucratic | WhatsApp-familiar chat that *is* the CRM |
| Recommenders feel like a black box | Transparent, explainable in-house match score (skills/industry/location/seniority) |
| Third-party SaaS blocks patentability | 100% in-house crypto/auth/matching/mail |
| Businesses can't send from their own domain | In-house DKIM signing + DNS-verified sending domains |

### 1.5 Target users
- **Primary:** job-seekers; small employers (2–50) hiring directly.
- **Secondary:** solo founders / agencies using the CRM + forms + custom-domain mail.
- **Tertiary:** enterprises needing an owned, encrypted, sovereign stack.

### 1.6 Expected outcomes & 1.7 Success metrics
- North-star: **Weekly Active Accounts** with ≥1 meaningful action (apply / message / contact update).
- Signup→first action < 5 min · 7-day retention target 60% · match transparency (every score has a reason) · message delivery ≥ 99.9% · payment success (CHF) tracked per gateway.

---

## 2. Functional Requirements

Each capability is documented as: **Purpose · Flow · Business logic · I/O · Validation · Errors · Success · Edge cases · Permissions · Data flow · UI · API · Backend · DB · Notifications · Logs · Analytics.** Status tags mark reality.

### 2.1 Authentication & account `✅ BUILT`
- **Register** (`POST /api/auth/register`) — email + password (min 8, upper+digit+symbol), role `JOBSEEKER|EMPLOYER`. On success: `User` row (bcrypt hash, cost 12), auto-`Profile`, JWT issued in httpOnly cookie `er_token`. A **Workspace** is lazily provisioned on first CRM use (`lib/workspace.ts::ensureWorkspace`).
  - Validation: RFC-5322 email unique; password policy; role enum. Errors: `409` duplicate, `422` weak password, `429` rate-limited.
- **Login** (`POST /api/auth/login`) — verify bcrypt; then branch:
  1. If `faceVector` enrolled → `{requiresFaceVerify, userId}` → `/verify/face-login`.
  2. Else if `twoFactorEnabled` → `{requires2FA, method: "totp"|"email", userId}` → `/verify/2fa`.
  3. Else issue session cookie directly.
  - Never reveal which credential was wrong (`401 "Invalid email or password"`). Banned → `403`.
- **Logout** (`POST /api/auth/logout`) clears cookie.
- **Session** — JWT (`lib/jwt.ts`, HS256, 7-day expiry). `Session`/`LoginAttempt` models exist for device/audit tracking `◑ PARTIAL`.
- **Me** (`GET /api/auth/me`, `force-dynamic`) returns the safe user projection; `401` if no/invalid cookie.

### 2.2 Two-factor: authenticator (TOTP) `✅ BUILT` — fully in-house
- `lib/totp.ts`: RFC 4226 (HOTP) + RFC 6238 (TOTP) on Node `crypto` only — own base32 codec, HMAC-SHA1 truncation, `timingSafeEqual`, ±1 step drift, `otpauth://` URI + `formatSecret`.
- Endpoints: `setup` (generate secret, store `totp:<secret>` pending, return formatted key + otpauth URI + QR), `enable` (verify a live code → `twoFactorEnabled=true`), `disable` (requires a valid code), `verify` (login step 2 → session).
- QR: `lib/qrcode.ts` — **in-house QR generator** (ISO/IEC 18004: GF(256) Reed–Solomon, 8 masks + penalty, BCH format/version), rendered as inline SVG (`components/ui/QRCode`). Verified byte-exact against RFC 4226 vectors.
- Compatible with Google Authenticator, Duo, Microsoft Authenticator, Aegis.
- **Tested:** all 10 RFC 4226 vectors + RFC 6238 T=59 + full E2E (setup→wrong-rejected→enable→login-requires-TOTP→wrong-rejected→verify→session→disable).

### 2.3 Passkeys / fingerprint (WebAuthn) `✅ BUILT` — fully in-house
- `lib/cbor.ts` (own RFC 8949 decoder), `lib/webauthn.ts` (COSE→JWK, ES256 DER + RS256 verify, rpIdHash/origin/challenge binding, **signature-counter clone detection**), `lib/webauthn-client.ts` (browser `navigator.credentials`).
- Endpoints: `register-options`, `register-verify`, `login-options`, `login-verify`, `credentials` (list/delete). Challenges persisted in `AuthChallenge` (Next bundles routes separately → module memory is not shared; DB is the correct store).
- UI: Settings → Security → "Add fingerprint / passkey"; Login → "Sign in with fingerprint / passkey".
- **Tested:** synthetic FIDO2 authenticator (real P-256, real CBOR, real ES256 DER) — 9/9: register, replay-rejected, tampered-sig rejected, valid assertion→session, cloned-counter rejected, delete.

### 2.4 Face login (liveness) `◑ PARTIAL`
- `/verify/face-setup`, `/verify/face-login`; `lib/faceVector.ts` (AES-encrypted 128-d vector; **no raw images stored**); endpoints `face-enroll`, `face-verify`, `face-challenge`; `FaceVectorHistory`, `IdentityVerification` models.
- Client uses `face-api.js` models under `/public/models` for descriptor + blink/liveness. **Assumption:** face-api models are an acceptable client-side dependency (models, not a service); the stored artifact is our own encrypted vector. To be fully patent-clean, a from-scratch descriptor extractor is a `○ PLANNED` replacement.

### 2.5 Jobs — search, detail, apply `✅ BUILT`
- **List** (`GET /api/jobs`) — filters `q`, `industry`, `type`, `remote`, pagination (20/page). Includes `postedBy`, `skills`, `_count.applications`. **If authenticated**, attaches a personalised `match` per job (see 2.6).
- **Detail** (`GET /api/jobs/[id]`) + `/jobs/[id]` page (Next-14 plain `params`). **Apply** (`POST /api/applications`) with optional cover letter → `Application` (status `APPLIED`) + `StatusEvent` + notification to employer.
- **Post job** (employers, `POST /api/jobs`) → creates `Job` + `JobSkill[]` (upsert `Skill`) + a `JobCommunity`.
- **View tracking** `/api/jobs/view`. **Matched** page `/jobs/match` + `/api/jobs/match`.

### 2.6 In-house matching engine `✅ BUILT` — bidirectional, explainable
- `lib/matching.ts` — deterministic, zero-dependency. Weighted score /100: **skills 40, keywords 20, industry 15, location 15, seniority 10**, with tokenisation + stopwords, seniority inference, years-of-experience ranking. Returns `{score,label,breakdown,matchedSkills,missingSkills,reasons}`.
- Same function powers candidate→job ("your match") and employer→candidate (`GET /api/jobs/[id]/candidates`, ranked applicants).
- **UX honesty rule:** when a signed-in user's profile is too sparse to match (no skill hits, best score < 55), the jobs page shows a *complete-your-profile* banner instead of a wall of meaningless "Low match" — the recommender must visibly respond to profile data.

### 2.7 Applications pipeline `✅ BUILT`
- Statuses: `APPLIED → REVIEWED → SHORTLISTED → INTERVIEW → ASSESSMENT → OFFERED → HIRED` (+ `REJECTED`). Employer transitions via `/api/applications/status`; each writes a `StatusEvent` and a notification. Seeker view `/dashboard/applications`; employer view `/dashboard/recruiter`.

### 2.8 CRM — Contacts, Pipeline, Activity, chat-is-CRM `✅ BUILT`
- **Workspace** auto-provisioned; roles `owner|admin|member|viewer` (`WorkspaceMember`).
- **Contacts** (`/api/crm/contacts`) — full record (identity, company, address, stage `LEAD|QUALIFIED|PROPOSAL|WON|LOST`, value+currency `CHF`, tags JSON, notes). Search/filter/sort + pipeline totals via `groupBy`. Duplicate-email `409`. Soft-delete.
- **Detail** (`/api/crm/contacts/[id]`) — activity timeline + messages; inline stage change logs `stage.changed`.
- **Contact messages** (`/api/crm/contacts/[id]/messages`) — chat that *is* the CRM (in/out), each logs an activity.
- **Pipeline** `/pipeline` — drag-and-drop kanban with per-column totals.
- **Tested:** 14/14 E2E (provision, CRUD, dup-409, validation, timeline, tags, stage logging, two-way messages, search, filter, 401, soft-delete).

### 2.9 Forms — lead capture `✅ BUILT`
- Builder `/forms/builder/[id]` (typed fields: text, longtext, email, phone, number, select, checkbox; reorder; required; publish toggle; share link; submissions tab).
- Public fill `/forms/[slug]` (no auth, standalone, "Powered by Vrittih").
- `POST /api/forms/[slug]/submissions` (public) → validate required + email → store `FormSubmission` → **auto-create/link a CRM `Contact`** (name-split, company, `form:` source) + `form.submitted` activity + dedupe on email.
- **Tested:** 13/13 E2E.

### 2.10 Communication suite
- **Messages** (user↔user) `✅ BUILT` — `Conversation`/`ConversationParticipant`/`Message`; realtime via **in-house WebSocket server** `server/chat.js` (`ws`, JWT `AUTH`, DB persistence, read receipts) on `:3001`.
- **Mail** (in-platform) `✅ BUILT` — `Mail` model; `/api/mail`, `/api/mail/send`.
- **Own mail transport (from-scratch SMTP client)** `✅ BUILT` — `lib/smtp.ts` speaks SMTP/ESMTP directly over `net`/`tls` (implicit TLS 465, STARTTLS upgrade, AUTH LOGIN/PLAIN, MX resolution via `dns`, multiline responses, dot-stuffing, timeouts). **`nodemailer` removed entirely** — OTP email, notification email, and the `email.send` job all route through `lib/smtp.ts`. **Tested 9/9** against an in-house test SMTP server (raw `net`): handshake, AUTH, envelope, message integrity, dot-stuffing round-trip, **DKIM-signed message validates across transport**, and error paths (auth-fail 535, RCPT-reject 550).
- **Custom-domain outbound mail** `✅ BUILT (signing + transport)` / `○ infra-gated (external delivery)` — `lib/dkim.ts` (RFC 6376 relaxed/relaxed, RSA-SHA256, own canonicalisation — verified vs the RFC example + tamper tests), `lib/mailer.ts` (assemble + sign), delivered by `lib/smtp.ts`; `EmailDomain` + `/api/mail/domains` (add/list/delete) + `/verify` (real DNS TXT lookups for `_vrittih` ownership + DKIM key). Reaching external inboxes still needs production egress (open port 25 or an authenticated smart-host) — the client itself is complete.
- **Interviews** (WebRTC) `✅ BUILT` — `/interviews`, `/interviews/[code]` room (audio/video/screen/hand/chat) via **in-house signaling** `server/signal.js` (socket.io) on `:3002`; `Interview`/`InterviewParticipant`; scheduling `/interviews/schedule`.
- **Network** `✅ BUILT` — `Connection` model; connect/respond/suggestions.
- **Community** `✅ BUILT` — `Channel`, `JobCommunity`, `ProfessionalSpace`, `ProfessionalPage` (+ members/posts/replies/follows).
- **Notifications** `✅ BUILT` — `Notification` model; `/api/notifications`; bell + `/notifications`.

### 2.11 Assessments / tests `✅ BUILT`
- `Test`/`Question`/`TestAttempt`/`Answer`; types Aptitude/Technical/Psychometric/Coding; tab-switch proctoring signal; pass score; `/tests`, `/tests/[id]`, `/tests/create`.

### 2.12 Payments `✅ BUILT (CHF)`
- One-time `1 CHF` join. `lib/payment.ts` `JOINING_FEE_CHF=1`; `/api/payment/create-order` (`currency:"CHF"`, amount `100`), `/verify`, `/test-gateway`. Razorpay client wired; **note:** confirm the Razorpay account supports CHF/international before go-live (native settlement is INR).
- `○ PLANNED` (spec): auto rail selection (UPI < 1L / cards / wire), invoices from chat, reconciliation.

### 2.13 Admin `✅ BUILT`
- `/admin` (+ users, jobs, payments, gateway, super); `/api/admin/*` (stats, users, jobs, payments, gateway, settings, broadcast, impersonate, activity). Gated to `ADMIN|SUPER_ADMIN`. Seed super-admin: `npm run seed:admin` → `superadmin@vrittih.online / SuperAdmin@2026`.

---

## 3. Complete User Experience

### 3.1 Global shell `✅ BUILT`
- **`components/vrittih/AppShell.tsx`** — the single app shell for every signed-in page: **left sidebar** (grouped, role-aware: *Overview · Jobs/Hiring · CRM · Connect · Grow · Admin*, active states, user chip) + **sticky topbar** (page title, global search → `/jobs?q=`, notification bell, avatar).
- Pages render `<AppShell title="…">…</AppShell>`. `CrmShell` is a thin proxy to `AppShell`.
- **No-shell surfaces (intentional):** landing `/`, auth (`/login`, `/register`, `/verify/2fa`, `/verify/face-login`), public form `/forms/[slug]`, admin (own `AdminShell`).

### 3.2 Design system `✅ BUILT`
- **`styles/vrittih.css`** — `:root` tokens `--v-*`: accent **indigo `#534AB7`** (spec focus-ring), calm neutrals, serif display stack `--v-serif`, radii, shadows. Loaded globally in `app/layout.tsx`. **Rule:** use `var(--v-*)`, never literal hex, in new work.
- Dashboard is the reference for market-level composition: serif greeting, stat tiles (serif tabular numerals + accent underline), **onboarding progress ring (SVG)** with actionable checklist, refined panels/empty states.
- `◑ PARTIAL`: some page *internals* still use older inline purple; next pass migrates them to tokens.

### 3.3 Page inventory (built)
`/` landing · `/login` `/register` · `/dashboard` (+ `/applications` `/post-job` `/recruiter`) · `/jobs` `/jobs/[id]` `/jobs/match` · `/contacts` `/contacts/new` `/contacts/[id]` · `/pipeline` · `/forms` `/forms/builder/[id]` `/forms/[slug]` · `/messages` `/mail` · `/interviews` `/interviews/[code]` `/interviews/schedule` · `/network` `/community` (+ job/space/pages) · `/channels` · `/tests` `/tests/[id]` `/tests/create` · `/notifications` `/resume` `/profile` `/profile/edit` · `/settings` · `/pay` · `/analytics` · `/verify/*` · `/admin/*`.

### 3.4 States & interaction `◑ PARTIAL`
- Loading (spinner/skeleton), empty (icon + copy + CTA — see dashboard/jobs/forms), success/error toasts, confirm dialogs for destructive actions. Onboarding = the dashboard progress ring.
- `○ PLANNED` to full spec: ⌘K command palette, global keyboard shortcuts, offline service-worker + IndexedDB queue, full WCAG 2.1 AA audit, dark mode via token swap, reduced-motion pass (tokens already respect it on landing).

### 3.5 Responsive `◑ PARTIAL`
- Desktop three-region shell built. `○ PLANNED`: sidebar collapse < 1024px, mobile bottom-nav, chat full-screen on mobile.

---

## 4. Business Logic

### 4.1 Roles & permissions `✅ BUILT`
- Platform roles: `JOBSEEKER | EMPLOYER | ADMIN | SUPER_ADMIN` (on `User`).
- Workspace roles: `owner | admin | member | viewer` (`WorkspaceMember`); write gated by `canWrite` (owner/admin/member); viewers read-only.
- Employer-only: post jobs, manage sending domains, view candidates.

### 4.2 State machines `✅ BUILT`
- **Application:** `APPLIED→REVIEWED→SHORTLISTED→INTERVIEW→ASSESSMENT→OFFERED→HIRED`, plus `REJECTED` from any; every transition → `StatusEvent` + notification.
- **Deal (Contact.stage):** `LEAD→QUALIFIED→PROPOSAL→WON|LOST`; each change → `Activity(stage.changed)`.
- **2FA/passkey:** setup(pending)→enabled→disabled (disable requires proof).
- `○ PLANNED` message state machine: `sending→sent→delivered→partial(read-depth)→read`.

### 4.3 Calculations `✅ BUILT`
- Match score (2.6). Pipeline totals = `SUM(value) GROUP BY stage WHERE deleted_at IS NULL`. Onboarding % = completed steps / total. Years-of-experience from `Experience` date spans.

### 4.4 Validation `✅ BUILT`
- Zod schemas on mutating endpoints (jobs, contacts, forms). Emails lowercased+unique-per-scope; domains regex-validated; message length ≤ 10k; tags ≤ 20.

### 4.5 Automation & retry `◑ PARTIAL / ○ PLANNED`
- Built: form→contact automation; status→notification.
- Planned: IF/THEN rules (form→create, won→thank-you, stale→nudge), background job retries (exponential backoff), webhook dead-letter, reconciliation.

---

## 5. Database Design

- **Engine:** SQLite (dev) via Prisma; `datasource db { provider = "sqlite" }`. **Migration path:** Postgres for production (swap provider; `pg` already a dependency). IDs are `cuid()`. Timestamps `createdAt/updatedAt`. Soft-delete via `deletedAt` on user-visible entities.
- **54 models** (`prisma/schema.prisma`), grouped:

**Identity & auth:** `User`, `Profile`, `Session`, `LoginAttempt`, `AuthChallenge`, `WebAuthnCredential`, `FaceVectorHistory`, `IdentityVerification`.
**Workspace/CRM:** `Workspace`, `WorkspaceMember`, `Contact`, `Activity`, `ContactMessage`, `Form`, `FormSubmission`, `EmailDomain`.
**Jobs:** `Job`, `JobSkill`, `Skill`, `UserSkill`, `Application`, `StatusEvent`, `Education`, `Experience`, `EmployerGuarantee`, `ApplicantGuarantee`.
**Comms:** `Conversation`, `ConversationParticipant`, `Message`, `Mail`, `Notification`, `Connection`, `ActivityLog`, `Setting`.
**Community:** `Channel`, `ChannelMember`, `ChannelPost`, `ChannelReply`, `JobCommunity`(+Member/Post/Reply), `ProfessionalSpace`(+Member/Post/Reply), `ProfessionalPage`, `PageFollow`, `PagePost`, `PagePostReply`.
**Interviews:** `Interview`, `InterviewParticipant`.
**Assessments:** `Test`, `Question`, `TestAttempt`, `Answer`.

- **Key relations/constraints (examples):** `Contact.workspaceId → Workspace (cascade)`, unique `Skill.name`, unique `WebAuthnCredential.credentialId`, unique `EmailDomain.domain`, `@@unique([workspaceId,userId])` on `WorkspaceMember`, indexes on `(contactId,createdAt)`, `(workspaceId,stage)`.
- **Audit/versioning:** `ActivityLog`, `Activity`, `StatusEvent`, `FaceVectorHistory` provide history; `LoginAttempt`/`Session` for auth audit.
- **Assumption:** SQLite for dev is acceptable; production must run Postgres (JSON columns are stored as `String` today — on Postgres migrate `tags/fields/settings/payload` to `jsonb`).

---

## 6. Backend Architecture

- **Runtime:** Next.js 14.2.29 App Router; API = Route Handlers under `app/api/**`. Two auxiliary **in-house Node servers**: `server/chat.js` (WebSocket messaging :3001), `server/signal.js` (WebRTC signaling :3002). Run all three: `npm run dev` + `dev:chat` + `dev:signal`, or `npm run dev:all`.
- **Service libs (`lib/`, all in-house):** `jwt`, `cookies`, `hash` (bcrypt), `prisma`, `matching`, `totp`, `webauthn` + `cbor`, `dkim` + `mailer`, `qrcode`, `faceVector`, `workspace`, `crmMeta`, `notify`, `ratelimit`, `settings`, `payment`/`razorpay`, `validate`, `admin`, `otpStore`.
- **Middleware pattern (per handler):** cookie→`verifyToken`→role/ownership check→Zod validate→business logic→activity/notification→JSON. Auth endpoints and cookie-reading routes set `export const dynamic = "force-dynamic"`.
- **Config:** `next.config.js` — webpack fallbacks (`fs:false, encoding:false`) + server-externals for `face-api.js`/`tesseract.js` so client bundles stay clean.
- **Background jobs `✅ BUILT` — in-house, no Redis/BullMQ:** `BackgroundJob` table + `lib/jobs.ts` (enqueue, delay, priority, **exponential-backoff retries**, **dead-letter**, stale-lock recovery) + handlers (`lib/jobHandlers.ts`: `notification.create/broadcast`, `email.send`) + drain endpoint `/api/internal/jobs/tick` + worker process `server/worker.js` (`npm run dev:worker`, or bundled in `dev:all`). Wired: public form submission fans out an owner notification via the queue. **Tested 7/7** (done, dead-letter, retry+backoff, unknown-type, real form wire, worker delivery, stats).
- `○ PLANNED`: Redis for sessions/presence/distributed rate-limit at scale (the DB queue is sufficient for single-region).

## 7. Frontend Architecture
- `app/**` route-colocated pages (`"use client"` where interactive). Shared UI in `components/` (`ui/Icons.tsx` — **50+ in-house stroke SVGs, no emoji**; `ui/QRCode`, `ui/NotificationBell`; `vrittih/AppShell`; `crm/CrmShell`; `layout/Navbar` legacy; `admin/*`).
- State: local React state + `fetch`; no external state lib. Styling: CSS Modules + inline token styles + `styles/vrittih.css`. Suspense boundaries around `useSearchParams`.
- `○ PLANNED`: React Query caching, error boundaries per route, code-split heavy pages, ⌘K palette.

## 8. APIs
- **~90 endpoints** under `/api/**` (full list generated from `find app/api -name route.ts`). Auth via httpOnly `er_token` cookie (JWT). JSON in/out. Errors as `{ error }` + status (`400` validation, `401` unauth, `403` role, `404`, `409` conflict, `429` rate-limit, `500`).
- **Representative contracts:**
  - `POST /api/auth/login` → `{success,user}` + cookie · or `{requires2FA,method,userId}` · or `{requiresFaceVerify,userId}`.
  - `GET /api/jobs?q=&industry=&type=&remote=&page=` → `{jobs[],total,page,pages}`; authed jobs include `match:{score,label,matchedSkills,reasons}`.
  - `POST /api/crm/contacts` (Zod) → `{success,contact}` | `409 {duplicateId}`.
  - `POST /api/forms/[slug]/submissions` (public) → `{success,message}`; side-effect: contact upsert.
  - `POST /api/auth/totp/verify` `{userId,code}` → `{success}` + cookie.
  - `POST /api/auth/webauthn/login-verify` `{userId,credentialId,authenticatorData,clientDataJSON,signature}` → `{success,user}` + cookie.
  - `POST /api/mail/domains` → `{domain,records[3]}` (ownership TXT, DKIM TXT, SPF).
- **Versioning `○ PLANNED`:** introduce `/api/v1/**` prefix before public release; current routes are v1-implicit.

## 9. Security
- **Passwords:** bcrypt cost 12 (`lib/hash`). **Sessions:** JWT HS256, httpOnly `SameSite=Lax` cookie, 7-day expiry.
- **2FA/passkeys:** §2.2/2.3 — in-house, RFC-grounded, verified.
- **RBAC:** platform + workspace roles enforced server-side on every mutation.
- **DKIM/domain trust:** §2.10.
- **Input:** Zod validation; Prisma parameterises queries (no SQL injection); message/length caps.
- **Face/biometric:** encrypted vectors only, never raw images; disable-2FA/passkey requires proof.
- `○ PLANNED`: CSRF origin checks on mutations, per-route rate limiting via Redis, CSP/security headers, file-upload MIME sniffing (`/api/upload` hardening), full audit-event table, secret rotation, compliance (GDPR export/delete).

## 10. Performance
- Dynamic routes server-rendered on demand; static where possible (build: 94/94 pages). Prisma `select`/`_count` to avoid over-fetch; indexes on hot paths.
- `○ PLANNED`: Redis cache, query/N+1 review, image/CDN, streaming, Postgres read replicas, load balancing, HA.

## 11. Notifications
- **Built:** in-app `Notification` + bell + `/notifications`; created on apply, status change, message, form submit. Email OTP via SMTP (`/api/auth/otp-request`, `nodemailer`).
- `○ PLANNED`: web-push, SMS, webhooks, scheduled reminders (interview T-15m), digest emails.

## 12. Analytics `✅ BUILT (pipeline)`
- **In-house event stream:** `AnalyticsEvent` table + `lib/analytics.ts` (`track()` — non-throwing; `summary()` aggregation) + `POST /api/analytics/track` (client events, user-attributed) + `GET /api/analytics/summary` (auth: totals, counts-by-name, per-day series, active users, recent). Wired `track()` into `signin.succeeded`, `contact.created`, `form.submitted`. **Tested 4/4** (aggregate, tracked events present, per-day+active-users, auth-gate).
- `○ PLANNED`: funnel/retention views, KPI dashboards on `/analytics`, expand `track()` to all key events (`job.apply`, `message.sent`, `match.viewed`).

## 13. Integrations
- **In-house by design.** External touchpoints: Razorpay (payments — CHF caveat), SMTP relay (email), authenticator apps (standard TOTP), platform DNS (domain verification). Each must have retry + failure handling `○ PLANNED`. **No** Supabase/Resend/LiveKit/hCaptcha (explicitly avoided for IP cleanliness).

## 14. Deployment
- **Envs:** `.env` keys — `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRY`, `SMTP_*`, `NEXT_PUBLIC_APP_URL`, `NODE_ENV`, `RAZORPAY_*`, `FACE_VECTOR_KEY`. Scripts: `dev`, `dev:all`, `dev:chat`, `dev:signal`, `build`, `start`, `seed:admin`.
- `○ PLANNED`: Postgres migration, containerise the three processes (web + chat + signal), CI/CD, secrets manager, monitoring/logging, backups, rollback. `DEPLOY.md` present.

## 15. Testing
- **Done (repeatable E2E, real crypto/data):** TOTP (RFC vectors + flow), WebAuthn (synthetic authenticator 9/9), DKIM (RFC canon + tamper 8/8), QR (RFC 4226 vectors), CRM (14/14), Forms (13/13). Every session ends on green `tsc` + `next build` (94/94).
- `○ PLANNED`: unit suite (Vitest/Jest), Playwright E2E, load tests, a11y automation, security scan, acceptance-criteria matrix per feature.

## 16. Documentation
- **This document** = master spec. Plus `DEPLOY.md`, `AGENTS.md`/`CLAUDE.md` (agent rules), in-code doc-comments on every in-house lib (`totp`, `webauthn`, `cbor`, `dkim`, `qrcode`, `matching`). `○ PLANNED`: API reference (OpenAPI), admin runbook, end-user help.

## 17. Future Scalability
- Multi-tenant already modelled (`Workspace`). `○ PLANNED`: Postgres + Redis + queues, service extraction (chat/signal already separate processes), i18n/l10n, feature flags, plugin surface, enterprise SSO, sovereign hosting.

## 18. Final Product Definition
From open to close: a visitor lands on the editorial `/` page → joins for `1 CHF` → is dropped into the **Vrittih shell**. A **job-seeker** completes an onboarding checklist (profile, identity, 2FA, first application — tracked by the dashboard ring), searches jobs that are **ranked by an explainable in-house match score**, applies, and watches status move live; secures the account with an **authenticator or fingerprint passkey** (both in-house). An **employer** posts a job, receives **AI-ranked candidates**, interviews them in a **native WebRTC room**, sends **assessments**, and manages every relationship in the **CRM** (contacts, drag-drop pipeline, chat-is-CRM, lead-capture forms that auto-create contacts) — sending mail from their **own DKIM-verified domain**. Everything — auth, 2FA, passkeys, QR, matching, DKIM, realtime — is **owned in-house** so Vrittih can be patented and run sovereign.

---

## 19. Assumptions Register
1. **Stack is in-house, not Supabase** — the pasted spec's Supabase/Resend/LiveKit are explicitly replaced by own Prisma/JWT/WS/crypto (patent goal). `[decided]`
2. **Currency is CHF**, platform-wide, despite India-first framing. `[decided]`
3. **SQLite for dev, Postgres for prod** — provider swap + JSON-column migration required before scale. `[open]`
4. **Repo folder stays `edurankai-jobs`**; product/brand is Vrittih. Login emails like `superadmin@edurankai.in` retained to avoid breaking auth; canonical admin is `superadmin@vrittih.online`. `[decided]`
5. **face-api.js models** are a tolerated client asset for face login; a from-scratch extractor is the patent-clean end-state. `[open]`
6. **Razorpay CHF** must be confirmed for the account; otherwise swap the gateway. `[open]`
7. Where the pasted spec and the built reality differ, **this document reflects the build** and marks the rest `○ PLANNED`. `[decided]`
