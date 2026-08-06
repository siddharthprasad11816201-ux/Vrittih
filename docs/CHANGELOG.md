# EduRankAI — Global Changelog

Reverse-chronological record of significant platform changes. Each implementation appends here.

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
