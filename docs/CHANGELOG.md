# EduRankAI — Global Changelog

Reverse-chronological record of significant platform changes. Each implementation appends here.

## 2026-08-09 (j) — Phase 15: Autonomous Enterprise AI
- **Autonomous planning shipped** — a goal becomes an ordered, explainable plan that executes through the AIOS gateway with human-in-the-loop approval. Reuses the existing in-house STRIPS planner (`lib/aios/plan`) — goals modelled as facts, capabilities as actions — no new planning math.
  - **Plan:** each domain (workforce/finance/projects) follows assess (gather real evidence via its capability) → deliberate (reason over that evidence via the Enterprise Brain, fed the prior steps' explanations as context) → decide (human-approved action). The planner finds the minimal ordered sequence with real dependency edges.
  - **Execute:** a resilient executor auto-runs capability steps through the gateway (authorized against the owner's own caps, audited with a runId, honest confidence), records denied steps as blocked and failures as errors WITHOUT aborting the plan, and PAUSES at every approval gate until the owner approves.
  - **API:** `/api/autonomy` (plans + goal catalog + create), `/api/autonomy/[id]/run` (advance), `/api/autonomy/[id]/approve` (approve the gate + continue), `/api/autonomy/[id]` (delete) — all owner-scoped. **UI:** `/autonomy` — pick a goal, watch the step-by-step plan execute with per-step evidence/confidence/audited-run, approve gated steps. Nav wired.
  - Fixed a real wiring bug found by the E2E: the executor imported the bare gateway (`@/lib/aios/execute`) so no capability providers were registered → now imports the index; and it passes a real `question` (+ prior-step context) to deliberate.
  - **Verified:** 8/8 planner unit + 18/18 live E2E (plan → gateway execution audited → approval gate pauses → approve → done; deliberate returns honest confidence + explanation; ownership/validation guards). Build clean (152 pages).
  - **Deploy note:** schema adds AutonomousPlan — run `prisma db push`/migrate on prod.

## 2026-08-09 (i) — Phase 14: Digital Twin
- **Digital Twin shipped** — a live model of the organisation + projects computed from REAL data, with pure, honest what-if simulators. Reuses the existing planning primitives (`lib/planning/workforce`) and project forecaster (`lib/project/intelligence`) — no duplicated math.
  - **Org twin:** live snapshot (active headcount, by-department, annual attrition from exited rows, 12-mo hire rate, avg annual cost parsed from real CHF salaries). Simulation: month-by-month headcount = prev − attrition + hires over N months, with a reused `budgetProjection` (hiring cost + annualised payroll, FX-safe). Honest `costAssumed` flag when no salary data.
  - **Project twin:** live snapshot (open tasks, measured weekly velocity, forecast ETA, team size). Simulation: add people (velocity scales) / change scope → re-forecast ETA via `forecastCompletion`, with delta vs baseline + honest confidence.
  - **Scenarios** persist (`TwinScenario`) — save / list / delete, owner-scoped.
  - **API:** `/api/twin` (live twins + projects + scenarios), `/api/twin/simulate` (run + optional save), `/api/twin/project/[id]`, `/api/twin/scenarios/[id]`. **UI:** `/twin` — org + project tabs, snapshot cards, sliders, projected-headcount sparkline, budget, saved scenarios. Nav wired.
  - **Verified:** 14/14 simulator unit + 15/15 live E2E (real employees → headcount/attrition/cost; 12-mo projection + budget; project twin from real tasks; save/list/delete + ownership 401). Build clean (151 pages).
  - **Deploy note:** schema adds TwinScenario — run `prisma db push`/migrate on prod.

## 2026-08-09 (h) — Phase 13: Automation Platform
- **Automation Platform shipped** — a real trigger → conditions → action engine over the AIOS event bus, audited per run. No stubs.
  - **Triggers** are REAL platform events only: `application.status_changed` + `job.created` (newly emitted onto the AIOS bus at their genuine call sites) + `ai.executed` (already emitted). The bus gained a wildcard (`*`) handler + event `type` in handler meta; automation registers once at AIOS bootstrap.
  - **Engine** (`lib/automation/engine.ts`, pure/testable): dot-path field reads, 7 operators (eq/ne/contains/gt/lt/exists/truthy), AND-semantics condition eval, and `{{field}}` interpolation.
  - **Actions** (`lib/automation/actions.ts`): `notify` (real Notification), `run-capability` (executes an AIOS capability through the gateway — authorized against the **owner's own** capabilities, no escalation, audited), `webhook` (validated + timed-out POST). Honest failures, never faked success.
  - **API:** `/api/automation` (list + create, catalog-validated), `/api/automation/[id]` (PATCH/DELETE, owner-scoped), `/api/automation/[id]/test` (dry-run that actually runs the action), `/api/automation/runs` (audit log). **UI:** `/automation` — rule builder (trigger + condition rows + action config), enable/disable, test, run history. Nav wired.
  - **Verified:** 20/20 engine unit + 12/12 live E2E (create → real `ai.executed` run → wildcard handler fires the matching rule → notify writes a real row → audited ok; non-matching rule gated; validation/test/toggle/auth). Build clean (150 pages).
  - **Deploy note:** schema adds AutomationRule + AutomationRun — run `prisma db push`/migrate on prod.

## 2026-08-09 (g) — Phase 12: Analytics & BI (complete)
- Verified the BI layer (4-agent assessment: /analytics, /executive, /recruitment-analytics, /learning-analytics + the intelligence engines) — all compute **real** metrics from live rows with honest confidence. Closed the genuine gaps found:
  - **Funnel correctness (real bug):** `/analytics` employer funnel was a lossy current-status snapshot (a HIRED app is no longer OFFERED → every upper stage undercounted, non-monotonic). Now derived from the **StatusEvent "ever-reached" timeline** (distinct applicationId), including ASSESSMENT/INTERVIEWING — matching `lib/intelligence/health.ts` and `/api/recruitment/analytics`. The "Interviews" KPI now uses the ever-reached count too.
  - **Forecasting (top gap):** the proven in-house forecast engine (`lib/intelligence/forecast.ts`) was only wired into `/executive`. Added **hiring-velocity forecasting** to `/api/recruitment/analytics` + `/recruitment-analytics`: real application + HIRED-event timestamps bucketed into 12 weekly windows, forecast 4 weeks ahead with honest confidence + method + basis, rendered as a sparkline (solid history, dashed projection).
  - **Tests (constitution "prove with real tests"):** added a forecast unit suite (linreg / method-selection / clamping / honest-confidence / bucketing) — 15/15.
- **Verified:** 15/15 forecast unit + 11/11 live E2E (recruitment velocity forecast on real org data: 12 buckets, 4-week projection, honest confidence; analytics 6-stage ever-reached funnel). Build clean (149 pages). No schema change.

## 2026-08-09 (f) — Phase 11: AI Marketplace
- **AI Marketplace shipped** (built on the staged MarketplaceItem/Install/Review models — no new schema). Surfaces the platform's real in-house AIOS capabilities as installable agents, plus user-published prompts/workflows.
  - **Catalog:** 14 in-house agents (Enterprise Brain, Career Coach, Recruiter Copilot, HR Copilot, Project Manager, Financial/Sales/Campus/Policy/Clinical intelligence, Research Assistant, AI Tutor, Opportunity Matcher, Career Frontier) — each mapped to a **real, gateway-executable capId** (integrity-tested: every seeded capId exists in the registry). Idempotent seeder preserves accrued installs/ratings.
  - **API:** `GET/POST /api/marketplace` (browse/search/sort + publish), `GET/DELETE /api/marketplace/[slug]`, `/install` (toggle), `/review` (install-gated, exact rating aggregate), `/run`. **Run executes the mapped capability through the AIOS gateway**, which enforces the *caller's own* authz + audits the run — installing an item can never escalate privilege. Governance: users may publish PROMPT/WORKFLOW only; AGENT/TOOL are admin-governed.
  - **UI:** `/marketplace` (browse / installed / my-items tabs, filters, install, publish modal) + `/marketplace/[slug]` (detail, gateway-run panel with evidence output + audited runId, install-gated reviews). Nav wired for employers (Operations) and candidates (Resources).
  - **Honesty:** ratings show a real average or "New" (never a fake 0/5); installs are real counters; run surfaces the gateway's honest failures (denied / no-evidence).
  - **Verified:** 30/30 unit + integrity, 16/16 E2E (login → seed → install → review + gate → publish + governance → gateway-run audited → 404s). Build clean (149 pages).

## 2026-08-09 (e) — foundation completeness remediation (pre-Phase-11 gate)
- **Whole-product completeness/authenticity audit** before advancing to new phases: a deterministic 100%-file scan (111 pages / 231 routes / 156 libs → 0 no-op handlers, 0 dead anchors, only 1 borderline marker, all correct) **plus** a 38-agent semantic audit of every shipped module (Phases 1–10 + copilots + platform), each finding adversarially verified → **27 CONFIRMED** (8 high / 13 med / 6 low; 0 refuted). A 23-check verify pass then caught 1 BROKEN + 3 CONCERN. **All 31 fixed; build clean (148 pages).**
  - **Jobs (HIGH):** requirements/benefits/experienceLevel/openings were silently dropped by the API schema — now persisted (new nullable Job columns) + rendered on job detail. Salary now Swiss `de-CH` grouping, not INR lakh.
  - **Assessments (HIGH):** blank-answer (manual-review) SHORT/CODING questions no longer score the candidate 0; new employer results view (`GET /api/tests/[id]/attempts`, owner/admin-scoped).
  - **Wiring gaps (HIGH×5):** funders can post grants + sponsors create challenges (Innovation); managers can write performance reviews + succession plans (HRMS); verified sending domains now do real DKIM-signed outbound (honest failure when unconfigured, never fake "sent").
  - **False data (HIGH):** Settings billing driven by the real plan (was hardcoded "1 CHF one-time / Lifetime").
  - **Med/low:** honest application-tracker stages; interview scorecard reachable + status transitions (guarded); Academy lesson content + authoring + `?course=` deep-link; research projects UI; workspace widget hide/reorder (server-seeded); university exams tab; government scheme status control; `/get-placed` uses the candidate's own input; public-profile Message/Connect wired; project delete; healthcare records viewer; career-plan deep links; account theme toggle persisted app-wide (global restore, no FOUC); removed inert preference rows.
  - **Admin:** maintenance mode now genuinely enforced (status API + AppShell guard, admin bypass, fail-open); removed the no-op "employer free post" toggle.
  - **Deploy note:** schema adds nullable Job columns — run `prisma db push`/migrate on prod.

## 2026-08-09 (d) — AI Constitution-compliance audit (honest confidence)
- **Dedicated AI-honesty audit** across every AI provider, Enterprise-Brain engine, intelligence lib, and AI-facing route (6 finder areas → adversarial per-finding verify; 4 CONFIRMED = 2 distinct bugs, 0 refuted). The AI layer is otherwise honest — sibling decision rules derive confidence from real coverage/R², `confidence: 0` returns are genuine insufficient-evidence, and deterministic providers correctly omit confidence.
  - **Fabricated confidence (MED):** `lib/intelligence/health.ts` `darkDomainRule` hardcoded `confidence: 0.9` on "…intelligence is dark" cards, rendered to executives as "Confidence: 90%". "0 of N metrics have data" is a *certain* coverage fact, so it now reports `confidence: 1` — consistent with the sibling rules and no longer an invented mid-range AI estimate.
  - **Fabricated confidence (LOW):** `lib/project/intelligence.ts` `forecastCompletion()` returned `confidence: 0.9` for a project with zero open tasks (a completed project — also a certainty, ETA = now); now `confidence: 1`. (Carried only in the API/audit payload, not rendered.)

## 2026-08-09 (c) — remaining-surfaces audit + resilience sweep
- **Third adversarial audit** over the remaining surfaces (learning/research/admin/messaging/offers/interviews/tests/network/community/contacts/settings/notifications; 29 agents, 21 CONFIRMED, 0 plausible, 4 refuted), then an 8-agent adversarial **verification** pass (0 BROKEN, 0 CONCERN) before commit — all fixed:
  - **SECURITY — IDOR (HIGH):** `POST /api/tests/[id]/submit` updated a `TestAttempt` by client-supplied `attemptId` alone (no owner/test/state check) — any candidate could overwrite another's attempt or re-score their own after seeing results. Now an **atomic status-conditional** `updateMany` scoped to `{id, userId, testId, status: IN_PROGRESS}` (+ separate `answer.createMany`), closing the cross-candidate IDOR, the re-submit bypass, and a self-race in one write. Added an `attemptId` input guard (400).
  - **SECURITY — cross-tenant read (MED):** `GET /api/learning/analytics` org rollup was gated by `hrms.view` (held by every Growth+ employer) but computed platform-wide totals + competency heatmap. Now scoped to the caller's own workforce; platform-wide totals stay behind `ai.ops.view`/`admin.access`.
  - **SECURITY — unauthenticated abuse (LOW):** HRMS `recognize` accepted any target user (cross-tenant recognition/notification spam). Added a shared-company gate (employer↔employee and same-employer colleagues only) mirroring `isMyEmployee`.
  - **Stuck-loading crashes (×19 pages):** notifications, network, settings, contacts (list/detail/new), interviews (list/room), tests (list/take/create), community (hub/space/job/pages hub+detail+create) now clear their loading/saving flag on network/5xx failure (try/finally or .catch/.finally, `res.json().catch(()=>({}))`), with error/retry or safe empty states — no more permanent spinners or stuck submit buttons.
  - **Resilience sweep (Group C, ×17 pages):** admin (dashboard/gateway/jobs/partners/payments/users), analytics, channels, companies (list/detail), dashboard (pipeline/post-job), forms, hrms, jobs/saved, mail, pipeline hardened to the same pattern. Bonus pre-existing same-class fixes: channels `sendPost`/`createChannel`, tests/[id] `startTest`/`handleSubmit` (now surface a retry instead of a broken result screen).
  - **Auth lockout guards:** login, register, and 2FA (verify + OTP resend) no longer strand the button on a network failure.
  - **False label (LOW):** research "Outputs" KPI (published-only count) relabelled "Published" to match the all-status "My outputs (N)" tab.

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
