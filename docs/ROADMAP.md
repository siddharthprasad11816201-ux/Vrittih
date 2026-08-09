# EduRankAI — Master Implementation Roadmap

> Single source of truth for overall progress. Every completed module updates this file.
> Last updated: 2026-08-06.

## Vision & philosophy
See [PLATFORM_CONSTITUTION.md](PLATFORM_CONSTITUTION.md). In short: one unified Enterprise Talent Intelligence & Human Capability Platform; a two-sided managed talent service powered by the Enterprise Brain; every AI decision evidence-based and explainable; benchmarked against human experts.

## Status legend
✅ done & verified (local) · 🟡 in progress · ⬜ not started · 🚀 = requires owner action to deploy

---

## Phases

| # | Phase | Scope | Status | % |
|---|-------|-------|--------|---|
| 1 | EROS — Recruitment OS | Jobs, applications, pipeline, offers, ICAE | ✅ | 100 |
| 2 | ELTOS — Learning & Talent Dev | Courses, competencies, tutor, mentoring, learning analytics | ✅ | 100 |
| 3 | ERIP — Research & Innovation | Research lifecycle, publications, peer review, citations, grants, challenges | ✅ | 100 |
| 4 | EHWOS — HRMS & Workforce | Performance, goals, 1:1s, recognition, succession, workforce planning | ✅ | 100 |
| 5 | EPCOS — Project & Collaboration | Projects, milestones, kanban, portfolio, wiki + **AI Project Manager** | ✅ | 100 |
| 6 | EERP — ERP Finance | Invoices, expenses, budgets, vendors, POs + **Financial Intelligence** (FX-safe) | ✅ | 100 |
| 7 | Enterprise CRM | Deals pipeline, campaigns, support + **AI Sales Assistant** | ✅ | 100 |
| 8 | University OS | Admissions, programs, students, faculty, exams + **Campus Intelligence** | ✅ | 100 |
| — | **EAIL — Enterprise Brain** | Unified `deliberate()` pipeline (reason+evaluate+recommend+reflect; evidence/confidence/risks/explainability) | ✅ | 100 |
| — | **Recruiter Copilot** (managed placement) | Employer requirement → brain-ranked candidates w/ evidence + salary + interview plan; candidate placement side | ✅ | 90 (UI pending) |
| — | AI copilot rebuilds to expert grade | Career Coach, Interview AI, Learning Tutor, Executive/HR Copilots → route through the brain | 🟡 | 15 |
| 9 | Government Platform | Citizen services, schemes, grievances + **Policy Intelligence** (brain-routed, FX-safe) | ✅ | 100 |
| 10 | Healthcare Platform | Patients, appointments, records, triage routing + **Clinical Ops Intelligence** (brain-routed) | ✅ | 100 |
| 11 | AI Marketplace | Agents/prompts/tools/workflows — install + run in-house agents via the gateway; publish prompts/workflows | ✅ | 100 |
| 12 | Analytics & BI | Dashboards, KPIs, forecasting (hiring velocity), decision intelligence (/executive) — real metrics, honest confidence | ✅ | 100 |
| 13 | Automation Platform | Rules engine (trigger→conditions→action) over the AIOS event bus, audited; notify / run-capability / webhook actions | ✅ | 100 |
| 14 | Digital Twin | Org + project twins computed from real data + pure what-if simulators (headcount/budget, ETA), saved scenarios | ✅ | 100 |
| 15 | Autonomous Enterprise AI | Autonomous planning, cross-platform intelligence, explainable AI | ⬜ | 0 |
| 16 | Global Platform & Ecosystem | API/developer platform, plugin framework, white-label, multi-tenancy | ⬜ (partial: partner/white-label shipped) | 20 |

**Current phase:** EAIL — rebuild AI capabilities to expert grade (per the AI Quality Recovery mandate). New business-module expansion (Phases 9–16) is intentionally paused until copilots pass the expert bar, then they are built on top of the brain.

**Overall platform completion (honest estimate): ~55%** — operational modules broad and tested; the intelligence layer (the actual product) is early: brain + one flagship copilot done, the rest pending.

## Milestones
- ✅ M1 Operational core (Phases 1–8) built + tested.
- ✅ M2 Enterprise Brain (`deliberate()`) live + audited.
- ✅ M3 First flagship copilot (Recruiter) rebuilt through the brain, evidence-based.
- 🟡 M4 All flagship copilots (Career Coach, Interview AI, Tutor, Executive) at expert grade.
- ⬜ M5 Placement UIs (`/hire`, `/get-placed`, HR desk) + candidate↔request matching loop.
- ⬜ M6 Phases 9–16 on the brain.
- 🚀 M7 Production launch.

## Dependencies
- Active: all copilots depend on `lib/intelligence/deliberate.ts` + AIOS gateway + Talent/Competency graph.
- Future: Phases 9–16 depend on the brain + domain data models (Government/Healthcare/Marketplace models already in schema).

## Blockers / Risks
- **Not deployed** — every feature is local-only. Launch blocked on owner action (Vercel `DATABASE_URL` → Supabase transaction pooler `:6543` + `pgbouncer=true&connection_limit=1`; the mitigation for the earlier `EMAXCONNSESSION` outage is already in `lib/prisma.ts`).
- Risk: candidate pool depth — evidence quality scales with real profiles/competencies; sparse data → honest low confidence (by design).
- Risk: intelligence quality is the hard part; expert-grade rebuild is multi-iteration per copilot.

## Technical debt
- SQLite locally / Postgres in prod (dual provider dance).
- Placement flagship lacks UIs (`/hire`, `/get-placed`, HR desk).
- Some vertical "advisors" (Sales/Campus/Finance/Project) are deterministic rule engines — to be upgraded to route through `deliberate()` for full evidence/confidence/reflection parity.
- Phase 9–11 models are staged in schema but unbuilt.

## Release roadmap / timeline
Iterative, local-first. No fixed calendar dates (owner-driven). Order: finish flagship copilots → placement UIs → deploy → Phases 9–16 on the brain.

## Acceptance criteria (per AI capability)
Expert would rely on it in real work; routes through the brain; every recommendation carries why/evidence/confidence/alternatives/risks; unit + E2E green; adversarial review clean; honest confidence.

## Production readiness checklist
- [ ] All flagship copilots pass domain-expert bar
- [ ] Placement UIs shipped
- [x] `lib/prisma.ts` pool-exhaustion mitigation
- [ ] Vercel `DATABASE_URL` → `:6543` transaction pooler (owner)
- [ ] Full `npm run build` clean on deploy (sqlite→postgresql auto-flip verified)
- [ ] Secrets/env set (Razorpay, JWT, etc.) — owner, at launch

## Changelog
- 2026-08-06 — Roadmap created. Phases 1–8 ✅; EAIL brain ✅; Recruiter Copilot flagship ✅ (UI pending). Copilot expert-grade rebuild in progress.
