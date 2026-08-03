# Enterprise Recruitment Operating System (EROS)

**Status:** Living engineering specification. Permanent source of truth for the EROS
program. Update the Implementation Tracker, DDRs, and Changelog with every change.

**Owner:** Vrittih / EduRankAI platform. **Last updated:** 2026-08-03.

---

## 0. Mission

The world's most intelligent recruitment platform — managing the complete talent
lifecycle from workforce planning to onboarding, across **every** workforce category
(campus, experienced, executive, research, faculty, government, healthcare,
international, gig, freelance, contractor, volunteer, internship, apprenticeship,
campus ambassador). Not a traditional ATS: an operating system that composes the
platforms already built.

**EROS builds almost nothing from scratch — it composes and gap-fills.** A large share
of the 9 modules already exists across ICAE, EIDP, AIOS, Workforce OS, and the career
engines. This spec's first job is to record, honestly, what EXISTS vs the true GAPS, so
we extend and never duplicate (hard constraint).

Inherited hard constraints: fully in-house (no external LLM/ML/vector DB — deterministic,
explainable), capability-driven authorization (never role), CHF pricing basis, honesty
(evidence + confidence, never fabricate), no emojis (own SVG icons), human-gated
sensitive actions, prove with real tests, deploy on push.

---

## 1. Architecture

EROS is an orchestration + gap-fill layer. Each module maps to existing systems plus
the specific new pieces it needs.

```
                         EROS (recruitment lifecycle)
   Plan ─► Architect ─► Source ─► Apply ─► Assess ─► Interview ─► Offer ─► Onboard
    │         │          │         │        │          │           │         │
    ▼         ▼          ▼         ▼        ▼          ▼           ▼         ▼
  EIDP      roles.ts    ICAE     Applic-   Test/     Interview   OFFER*    Internship
 forecast   roleCat.    opportu- ation     TestAtt-  + govern-  (NEW)     OS +
 (exists)   normalize   nity     mgmt      empt      ance        keystone  Employee
            (exists)    (exists) (exists)  (exists)  (exists)    module    onboarding
                                                     +scorecard*           (exists)
   All wired through: AIOS execute (audit+authz) · Capability framework ·
   Career match/DNA · EIDP intelligence · Knowledge/Semantic index · Notify/Webhooks
   (* = new in EROS)
```

New models EROS introduces (minimal — most data exists): **Offer**, **OfferEvent**
(this build); later **InterviewScorecard**, **TalentPool**/**TalentPoolMember**,
**JobTemplate**/**JobRequisition** (versioned).

---

## 2. Implementation Tracker (module-by-module: EXISTS / PARTIAL / GAP)

Legend: ✅ exists & reused · ◐ partial (extend) · ⬜ gap (build) · ▶ building now.

| Module | Status | Where / plan |
|---|---|---|
| **1. Strategic Workforce Planning** | ◐ | Forecasting engine exists (`lib/intelligence/forecast.ts`); EIDP series. GAP: a hiring-forecast/demand dashboard + budget/scenario. Plan: `/recruitment/planning` on the forecast engine. |
| **2. Job Architecture** | ◐ | `lib/career/roles.ts` (families/levels/ladders), `lib/roleCatalog.ts`, `lib/opportunity/normalize.ts`. GAP: `JobTemplate`/requisition, approval workflow, versioning, in-house JD generation. |
| **3. Talent CRM** | ◐ | `Contact` CRM (stages), `Company`, referrals partial. GAP: `TalentPool`/pools, silver-medalists, alumni, recruiter notes on candidates. |
| **4. AI Candidate Discovery** | ✅ | ICAE (`lib/opportunity/*`, `/api/opportunities/groups`), `lib/career/match`, semantic index (`lib/knowledge/semindex`), recommendations. Reused. |
| **5. Application Management** | ✅ | `Application`(+Form/Answer/Document), `StatusEvent` timeline, `/api/applications` (+ `/batch` from ICAE), status workflow. Reused. |
| **6. Interview Intelligence** | ◐ | Scheduling + who-may-attend governance + panels (`lib/interview/governance`, `/api/interviews`, `/interviews/*`). GAP: **scorecards / evaluation forms**, bias monitoring, interview analytics. |
| **7. Assessment Platform** | ✅ | `Test`/`TestAttempt`/`Question`/`Answer` (APTITUDE/TECHNICAL/PSYCHOMETRIC/CODING, proctoring signals). Reused; integrity checks present. |
| **8. Offer Management** | ▶ | **GAP — no `Offer` model.** THE keystone. Building now: `Offer`/`OfferEvent`, lifecycle state machine, compensation (FX-aware), approval, versioning, digital acceptance → HIRED + onboarding trigger, acceptance prediction, dashboards. |
| **9. Onboarding** | ◐ | Internship OS (`/internship`), `Employee.onboarding`, identity verification, mentor/buddy (internship). GAP: unify a general new-hire onboarding triggered by offer acceptance. |
| **AI Recruitment Intelligence** | ◐ | Match/DNA/funnel calibration (`lib/career/*`), EIDP decisions/forecast. GAP: offer-acceptance & hiring-success prediction (this build starts it), bias monitoring. |
| **Dashboards** | ◐ | Recruiter/pipeline (`/dashboard/*`), Executive (`/executive`). GAP: offer/forecast/assessment/campus workspaces. |
| **Workflow Automation** | ◐ | Notifications, webhooks, status transitions, cron (ingest/discover). GAP: approvals, SLA monitoring, reminders engine. |
| **AI Copilots** | ◐ | Career coach (AIOS). GAP: recruiter/hiring-manager/interviewer copilots via `execute()`. |

**This build (batch 1): Module 8 — Offer Management, complete.**

---

## 3. Dependencies

Reuses `lib/aios/*`, `lib/career/*`, `lib/opportunity/*`, `lib/intelligence/*`,
`lib/capability/*`, `lib/prisma`, `lib/db.ci`, `lib/fx`, `lib/notify`, `lib/webhooks`,
`lib/entitlements`. Data: `Application`, `StatusEvent`, `Job`, `User`, `Company`,
`Interview`, `Test`/`TestAttempt`, `Internship`, `Employee`. New: `Offer`, `OfferEvent`.
No third-party packages.

---

## 4. Verification

Per module: architecture review, security review (authz + no data leak), accessibility,
performance (bounded queries), AI/logic correctness, workflow correctness, regression,
scalability, responsive (mobile/tablet/desktop). Method: unit-test pure libs (tsc→node
harness), `npm run build` type-gate, adversarial review workflow (find → verify), deploy.

---

## 5. Design Decision Records

- **DDR-1: Compose, don't duplicate.** Every module maps to existing systems first; new
  models only where a genuine gap exists (Offer, scorecard, talent pool, requisition).
- **DDR-2: Offer is a first-class entity, not a status.** "HIRED" (application status)
  is the *outcome* of an accepted Offer, not the offer itself. Offers carry
  compensation, approval, versioning, and a lifecycle independent of the application.
- **DDR-3: Human-gated, capability-driven.** Offer create/approve/send require
  `pipeline.manage`/`jobs.post`; approval is a distinct step; candidates act only on
  their own offers. Never a role check.
- **DDR-4: Predictions are deterministic & explainable.** Offer-acceptance prediction is
  a transparent factor model (match, compensation completeness, response window), with
  factors + confidence — never a black box, never fabricated.
- **DDR-5: FX-safe money.** Compensation stores an explicit currency; never sum across
  currencies without `lib/fx` normalization.

---

## 6. Known Gaps (program-level, tracked)

- Modules 1/2/3/6/9 have partial coverage; their GAP items (above) are queued after the
  Offer keystone. Batch order: Offer → Interview Scorecards → Job Architecture/
  Requisitions → Talent Pools → Workforce-planning dashboard → Copilots.
- No market salary dataset → salary benchmarking is heuristic until a source exists.
- Bias monitoring is deterministic-signal only (no protected-attribute data stored).

---

## 7. Migration Notes

Offer Management adds `Offer` + `OfferEvent` + two `User` relations via the standard
dual-DB push dance (sqlite local, Postgres prod). Additive, no data loss. Subsequent
modules add their models the same way. Local schema provider is always restored to
`sqlite` before commit (Vercel auto-flips to postgres on deploy).

---

## 8. Roadmap

1. **Batch 1 (now):** Module 8 Offer Management — model, lifecycle, compensation,
   approval, versioning, acceptance→HIRED, prediction, dashboards, review.
2. **Batch 2:** Module 6 Interview Scorecards + evaluation + bias signals + analytics.
3. **Batch 3:** Module 2 Job Architecture — templates/requisitions, approval, versioning,
   in-house JD generation.
4. **Batch 4:** Module 3 Talent Pools + recruiter notes + silver-medalists/alumni.
5. **Batch 5:** Module 1 Workforce-planning dashboard (forecast/budget/scenario).
6. **Batch 6:** AI Copilots (recruiter/hiring-manager/interviewer) via AIOS `execute()`.
7. Cross-cutting: workflow automation (reminders/SLA), per-persona dashboards.

---

## 9. Changelog

- **2026-08-03** — Spec created. Architecture, module-by-module tracker (exists/partial/
  gap), dependencies, verification, DDRs, known gaps, migration notes, roadmap.
  Batch 1 (Offer Management) begins immediately.
