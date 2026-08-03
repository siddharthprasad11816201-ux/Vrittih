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
| **1. Strategic Workforce Planning** | ✅ | `lib/planning/workforce.ts` (headcount ramp, compounding growth scenarios, FX-safe budget projection, lead-time hiring plan; 6 tests) over the EIDP forecast engine. `/api/planning/workforce` forecasts hiring demand / applications / org growth from real series + skill demand + open-role load; `/workforce-planning` UI (forecasts, skill demand, interactive scenario & budget planner). No new schema. |
| **2. Job Architecture** | ✅ | Families/levels/ladders (`lib/career/roles.ts`) + **versioned `JobTemplate`** with a governed approval lifecycle (`lib/jobarch/lifecycle.ts`), an **in-house deterministic JD assistant** (`lib/jobarch/jd.ts`, no external LLM — 15 tests) + competency libraries, a **role-similarity engine** (`lib/jobarch/similarity.ts` — comparison/semantic search, 14 tests w/ lifecycle), `/api/job-templates*` and the `/job-architecture` UI (create → JD preview → draft → approve → reusable library). |
| **3. Talent CRM** | ✅ | **TalentPool** (8 kinds: pool/silver-medalist/campus/alumni/referral/passive/community/research) + **TalentPoolMember** with relationship stages + deterministic **pipeline-health** (`lib/talent/pools.ts`), **semantic talent discovery** (`lib/talent/discovery.ts` — skill-graph match, no embeddings; 12 tests across both), **Referral** network with status workflow. `/api/talent/*` + `/api/referrals` + `/talent` UI (pools · discover · referrals). |
| **4. AI Candidate Discovery** | ✅ | ICAE (`lib/opportunity/*`, `/api/opportunities/groups`), `lib/career/match`, semantic index (`lib/knowledge/semindex`), recommendations. Reused. |
| **5. Application Management** | ✅ | `Application`(+Form/Answer/Document), `StatusEvent` timeline, `/api/applications` (+ `/batch` from ICAE), status workflow. Reused. |
| **6. Interview Intelligence** | ✅ | Scheduling + governance + panels; **scorecards** (`InterviewScorecard`, `/api/interviews/[id]/scorecard`, `/interviews/[code]/evaluate`) with competency aggregation, panel consensus + bias signals (`lib/interview/scorecard.ts`, 13 tests); **semantic proctoring Phase 1** (`ProctorSession`/`ProctorEvent`, `lib/proctor/events.ts` 14 tests, `/api/proctor/*`, consent-gated on-device `ProctorCapture`, human-authoritative reviewer console `/proctoring`). Architecture: `docs/interview/MULTIMODAL_INTERVIEW_PROCTORING_PLATFORM.md`. Follow-ups: room/test-attempt capture mounts, interview analytics dashboard, Phase-2 on-device CV. |
| **7. Assessment Platform** | ✅ | `Test`/`TestAttempt`/`Question`/`Answer` (APTITUDE/TECHNICAL/PSYCHOMETRIC/CODING, proctoring signals). Reused; integrity checks present. Intelligent-proctoring architecture in `docs/interview/MULTIMODAL_INTERVIEW_PROCTORING_PLATFORM.md` (semantic-event, consent-first, on-device, human-reviewed). |
| **8. Offer Management** | ▶ | **GAP — no `Offer` model.** THE keystone. Building now: `Offer`/`OfferEvent`, lifecycle state machine, compensation (FX-aware), approval, versioning, digital acceptance → HIRED + onboarding trigger, acceptance prediction, dashboards. |
| **9. Onboarding** | ◐ | Internship OS (`/internship`), `Employee.onboarding`, identity verification, mentor/buddy (internship). GAP: unify a general new-hire onboarding triggered by offer acceptance. |
| **AI Recruitment Intelligence** | ◐ | Match/DNA/funnel calibration (`lib/career/*`), EIDP decisions/forecast. GAP: offer-acceptance & hiring-success prediction (this build starts it), bias monitoring. |
| **Dashboards** | ◐ | Recruiter/pipeline (`/dashboard/*`), Executive (`/executive`). GAP: offer/forecast/assessment/campus workspaces. |
| **Workflow Automation** | ◐ | Notifications, webhooks, status transitions, cron (ingest/discover). GAP: approvals, SLA monitoring, reminders engine. |
| **AI Copilots** | ✅ | Career coach + **Recruiter Copilot** (`lib/copilot/recruit.ts`, 8 tests) — deterministic next-best-actions from real pipeline state, registered as AIOS capability `recruit.copilot` and run through `execute()` (audited via AiRun). `/api/copilot/recruit` + `/copilot` UI. |
| **Workflow Automation** | ✅ | `/api/cron/recruit-automation` (daily): interview reminders, offer-expiry nudges, stale-pipeline SLA digests via the notification engine. Registered in vercel.json. |

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
- **2026-08-03** — Batch 1 shipped: **Module 8 Offer Management** (Offer/OfferEvent
  models, lifecycle + acceptance-prediction libs, 3 APIs, /offers UI, nav), then
  adversarially reviewed (18 agents) — **12 confirmed defects fixed** (candidate leak of
  never-sent offers, detail redaction, atomic accept + optimistic guard, action-button
  ↔ API-governance alignment, jobId ownership, transactional revise, positive-only
  edit validation, terminal-DECLINED, NaN-fit honesty). Build green.
- **2026-08-03** — Modules 6/7 architecture: authored the enterprise **Multimodal
  Interview, Assessment, Intelligent Proctoring & Recruitment Intelligence
  specification** (`docs/interview/MULTIMODAL_INTERVIEW_PROCTORING_PLATFORM.md`, all 30
  deliverable sections, evidence-first & privacy-first). Pre-built
  `lib/interview/scorecard.ts` (competency aggregation + bias signals, 13 tests) toward
  Batch 2.
- **2026-08-03** — Batch 2 review (13 agents) → **6 confirmed defects fixed**: proctoring
  auto-triage no longer sticks terminally at CLEARED (atomic, re-escalating, guarded on
  `reviewedById:null`); risk score has a per-type cap (one noisy signal can't reach
  "high"); `ProctorCapture` now persists consent across lobby→room and captures during
  the live interview; proctor ingest validates refId ownership + drops unknown event
  types + reduces `evidence` to an allow-listed metadata scalar set at the trust
  boundary; single-panelist consensus no longer inflates to 1.0.
- **2026-08-03** — Batch 3 shipped: **Module 2/3 Job Architecture** (JobTemplate +
  versioned approval lifecycle, in-house JD assistant, competency libraries,
  role-similarity engine, `/api/job-templates*`, `/job-architecture`). Both DBs migrated.
- **2026-08-03** — Batch 3 review (6 agents) → **2 confirmed fixed**: JD nice-to-haves
  inverted (advanced/adjacent skills that build on the required ones, never a required
  skill's prerequisites shown as optional); admin "Approved library" no longer empties
  (author-scoped `mine` + an admin "Awaiting approval" tab makes the approval workflow
  reachable).
- **2026-08-03** — Batch 4 shipped: **Module 4 Talent CRM** (TalentPool/Member +
  pipeline health, semantic discovery, Referral network; `/api/talent/*`,
  `/api/referrals`, `/talent`). Both DBs migrated. Build green.
- **2026-08-03** — Batch 2 shipped: **Module 6 Interview Intelligence + Semantic
  Proctoring (Phase 1)**. InterviewScorecard model + submit/aggregate API +
  `/interviews/[code]/evaluate` (competency ratings → explainable panel decision with
  consensus + bias signals). ProctorSession/ProctorEvent models + `lib/proctor/events.ts`
  (taxonomy, severity, deterministic risk, 14 tests) + consent-gated on-device
  `ProctorCapture` (browser signals, metadata only, mounted in the interview lobby for
  candidates) + `/api/proctor/*` + human-authoritative reviewer console `/proctoring`
  (risk triage → human CLEARED/FLAGGED, never auto-guilt). Nav: Integrity. Migrated both
  DBs. Build green. Adversarial review next.
