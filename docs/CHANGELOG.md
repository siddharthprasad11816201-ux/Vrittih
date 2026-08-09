# EduRankAI — Global Changelog

Reverse-chronological record of significant platform changes. Each implementation appends here.

## 2026-08-09 (b) — core-flow audit
- **Second adversarial audit** over the core candidate/employer journeys (21 agents; 14 CONFIRMED, 1 plausible, 2 refuted) — all fixed:
  - **AUTHZ:** HRMS `create-review`/`schedule-1on1` accepted an arbitrary subject (any employer could write reviews/1:1s onto any user, poisoning competency evidence) → added `isMyEmployee` guard. Verified non-employee→403, employee→201.
  - **Dead/mislabeled links (×3):** pipeline "Import candidates"→/dashboard/post-job; dashboard Applications tile label/href; account "View public profile"→/u/{id}.
  - **False metrics (×2):** offer-acceptance single-source + clamp; trial cap via constant.
  - **Stuck-loading crashes (×7):** jobs list/detail/match, dashboard, career, profile, profile/edit now clear loading + show fallback on network/5xx.
- Mobile: projects kanban columns min-width + horizontal scroll.

## 2026-08-09
- **Adversarial audit + full remediation** (19 agents; 13 CONFIRMED, 0 plausible, 2 refuted; each finding independently verified):
  - **SECURITY (HIGH×5):** closed a cross-tenant IDOR/PII leak — `isHr` had keyed off employer-baseline capabilities, letting any employer read/modify other employers' talent/placement requests, candidate PII, and run shortlists. `isHr` is now `admin.access`-only (Vrittih HR = platform staff). Verified employer→403, admin still sees queue (6/6).
  - Dead/loop CTAs (career coach + /opportunities) → `/profile/edit`.
  - `/career/readiness` empty-state TypeError guard + route validate/slice trim fix.
  - Removed fabricated run-level confidence from deterministic providers (sales/campus/project/finance); HR now reports the real mean of per-employee deliberations.
  - `/hire` now persists + renders the promised salary band + interview plan per candidate.
  - Deterministic link scan: 0 dead links across 342 routes.

## 2026-08-07
- **Managed placement — candidate side** shipped: `/get-placed` + `candidate.opportunities` (brain-matched openings with evidence). Two-sided loop now complete (10/10 E2E).
- **PRODUCTION LIVE**: pushed to `origin/main`, migrated prod Supabase (all tables synced); www.vrittih.online fully live — all pages 200, new-table APIs 401 (not 500).
- **Phase 6 HCM — HR Copilot (Workforce Intelligence)** shipped: evidence-based attrition risk + promotion readiness per employee, routed through the Enterprise Brain (12 unit + 9 E2E). `/hr` + `/api/hr/copilot`. Extends existing HRMS/EHWOS (no duplication).
- Decoded the Phase 6→15 PDF spec (subsetted-font +29 offset) into a readable source.
- Deployment: `git push origin main` prepared (14 commits ahead, Vercel `vrittih.online` connected); production push requires user action / permission.

## 2026-08-06
- **Phase 11 Government** + **Phase 12 Healthcare** shipped — both route intelligence through the Enterprise Brain (Policy Intelligence 18+15 tests; Clinical Ops 19+14 tests; triage routing; FX-safe scheme reach). Build clean (144 pages).
- **/hire** managed-placement UI shipped — employer/HR interface over the Recruiter Copilot (describe requirement → AI shortlist → evidence-ranked candidates + stage mgmt). Renders 200; nav wired.
- Documentation system bootstrapped: full `docs/` tree + per-directory READMEs + global docs (KNOWN_GAPS, VERIFICATION_REPORT, ARCHITECTURE_INDEX, DESIGN_DECISION_RECORDS, CHANGELOG) + master-spec skeletons.
- **Recruiter Copilot** (managed placement) shipped, routed through the Enterprise Brain — 17/17 E2E on the "10 Backend Engineers" requirement.
- **EAIL Enterprise Brain** (`lib/intelligence/deliberate.ts`) shipped — 23 unit + 9 E2E.
- **Phase 7 CRM** (21+21) and **Phase 8 University OS** (21+18) shipped.
- Landing legal fix (fictional company names) + mobile polish + service-worker cache fix.
- Governance docs (Constitution, README, Roadmap, Tracker) created.

## Earlier (prior sessions)
- Phases 1–6 (Recruitment, Learning, Research, HRMS, Projects, ERP) + Phase 5/6 intelligence shipped and committed.
- DB pool-exhaustion mitigation in `lib/prisma.ts`.
