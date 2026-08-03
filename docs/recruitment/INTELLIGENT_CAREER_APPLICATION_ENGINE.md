# Intelligent Career Application Engine (ICAE)

**Status:** Living engineering specification. This is the permanent source of truth for
the ICAE program. Update the Implementation Tracker, Design Decision Records, and
Changelog with every change.

**Owner:** Vrittih / EduRankAI platform.
**Last updated:** 2026-08-03.

---

## 0. Mission

ICAE turns the platform from a job *search* portal into an **AI career strategist**
that continuously discovers opportunities, evaluates suitability, explains gaps,
recommends improvements, and lets a candidate apply to many related roles at once —
while keeping the human in control and never fabricating qualifications.

The experience should feel like a personal advisor working in the background, not a
search box. Candidates interact with **opportunity groups** (clusters of equivalent
roles across employers), not isolated postings.

Hard product constraints (inherited, non-negotiable):

- **Fully in-house.** No external LLM / ML / vector DB / third-party matching service.
  Every model is a deterministic, explainable, in-house algorithm (patent goal).
- **CHF is the pricing basis**; local currency is a display/collection concern.
- **Capability-driven authorization**, never role-driven. Sensitive actions are
  human-gated. No emojis in the product; own SVG icons only.
- **Honesty.** ICAE never invents skills, experience, publications, or achievements.
  It surfaces evidence and gaps; it does not manufacture them.

---

## 1. Architecture

ICAE is an **orchestration layer over the engines that already exist**. It adds no
new intelligence core; it composes the current ICIRE + AIOS primitives and adds the
two genuinely missing pieces: **opportunity normalization/grouping** and
**multi-company application**.

```
                    ┌────────────────────────────────────────────┐
                    │            ICAE orchestration               │
                    │  (lib/opportunity/*, /api/opportunities/*,   │
                    │   /api/applications/batch, /opportunities)   │
                    └───────────────┬────────────────────────────┘
        ┌───────────────────────────┼───────────────────────────────┐
        ▼                           ▼                                 ▼
  Normalization &            Intelligence core                Application core
  grouping (NEW)             (REUSED, ICIRE)                  (REUSED + batch)
  lib/opportunity/           lib/career/*                     app/api/applications
  - normalize.ts             - engine.analyzeCareer           - POST (single, existing)
  - groups.ts                - match.matchJob / rankJobs      - POST /batch (NEW)
                             - dna.computeCareerDNA           - ApplicationForm rules
                             - frontier / simulator           - snapshot / answers / docs
        └───────────────────────────┼───────────────────────────────┘
                                     ▼
                         AIOS gateway (REUSED)
                         lib/aios/execute + registry + events + audit (AiRun)
                                     ▼
                         Persistence (Prisma): Job, Application,
                         Recommendation(+Feedback), CareerProfile/Snapshot,
                         SavedJob, Skill/JobSkill
```

**Design rule:** ICAE MUST call `lib/career/match.matchJob` for readiness scoring and
`lib/career/engine.analyzeCareer` for the candidate profile. It MUST NOT introduce a
fourth scorer (see Known Gaps §12 — three already exist and are being reconciled, not
multiplied).

New modules ICAE owns:

| Path | Responsibility |
|---|---|
| `lib/opportunity/normalize.ts` | `Job.title` (+ description/skills) → canonical `{ roleKey, roleFamily, roleLabel, seniority, category }`. Pure. |
| `lib/opportunity/groups.ts` | Cluster live jobs into **related opportunity groups** by normalized role + seniority + skill overlap. Pure. |
| `app/api/opportunities/groups/route.ts` | For the current user: discover aligned groups, attach readiness (matchJob) + explainability per role. |
| `app/api/applications/batch/route.ts` | Apply to one / selected / all eligible roles in a group; preserve per-job requirements; per-job result report. |
| `app/opportunities/page.tsx` | Group-first UI: review a group, inspect employer-specific requirements, select & batch apply, see readiness/gap/why. |

---

## 2. AI Design

All ICAE "AI" is deterministic and explainable. There are four cooperating models,
each in-house:

1. **Skill/evidence model** (`lib/career/engine.ts`) — signals (profile, projects,
   experience, education, parsed documents) → weighted skill graph with confidence,
   level, and evidence provenance. This is the semantic layer: aliases + a bounded
   implication graph (`lib/career/taxonomy.ts` `IMPLY`) give "semantic" reach without
   embeddings — e.g. *React* implies *JSX, state management, component design*.
2. **Match model** (`lib/career/match.ts`) — candidate skill graph × job requirements
   → `MatchResult` (overall/technical/confidence, matched/missing, subscores, hiring
   funnel). Explainable by construction (`why[]`, per-skill contribution).
3. **Normalization model** (`lib/opportunity/normalize.ts`, NEW) — maps free-text
   titles to a canonical role identity so equivalent roles across employers collapse
   together. Rule-based over the owned role taxonomy (`lib/career/roles.ts` families +
   `lib/roleCatalog.ts` + `taxonomy.ts` skills).
4. **Recommendation/ranking model** (`lib/aios/recommend.ts` + `rankJobs`) — orders
   opportunities and groups by fit, with bounded outcome calibration
   (`lib/career/calibration.ts`, flag-gated).

Every ICAE capability that mutates or advises runs (or will run) through the **AIOS
gateway** `execute(capId, ctx)` so it inherits capability authorization, the `AiRun`
audit row, and event emission. Read-only group discovery may call the pure libs
directly for latency, but writes (batch apply) always audit.

---

## 3. Unified Opportunity Model

A posting is stored verbatim (`Job`) and, at read time, decorated with a **normalized
capability profile** — never mutating the employer's original text.

```ts
// Derived, not stored (v1). Computed by lib/opportunity/normalize.ts.
interface NormalizedRole {
  roleKey: string        // stable id, e.g. "swe" | "backend" | "data-scientist"
  roleFamily: string     // family key from lib/career/roles.ts FAMILIES
  roleLabel: string      // human label, e.g. "Software Engineer"
  seniority: Seniority   // INTERN|JUNIOR|MID|SENIOR|LEAD|EXECUTIVE (title+desc heuristic)
  category: Category     // primary skill category (taxonomy.ts)
  aliasesMatched: string[]
  confidence: number     // 0..1 — how sure the normalization is
}
interface Opportunity {         // = Job + normalization + (optional) per-user readiness
  job: Job
  normalized: NormalizedRole
  readiness?: MatchResult       // present when a candidate context is supplied
}
```

Titles recognized as the **same role** (examples): Software Engineer · Software
Development Engineer · Backend Engineer · Platform Engineer · Application Developer ·
Software Developer · Systems Engineer · Member of Technical Staff. Each keeps its
original title and requirements; the normalized `roleKey`/`seniority` is what groups them.

---

## 4. Matching Engine

Reuses `lib/career/match.ts`. ICAE adds no scoring math; it adds **fan-out** (score a
candidate against every job in a discovered group) and **aggregation** (group-level
readiness = distribution of per-role readiness, not a single number).

`MatchResult` (existing) is the contract:
`{ overall, technical, confidence, matched[], missing[{skill,difficulty,prepDays,expectedGain}], why[], subscores{technical,communication,leadership,research}, projectedMatch, prepDays, hiring{...,label} }`.

**Readiness bands** (ICAE display): Ready ≥ 75 · Competitive 60–74 · Stretch 45–59 ·
Aspirational < 45. Bands are display-only; the number is authoritative.

---

## 5. Application Engine (single + multi-company)

**Single apply** already exists (`POST /api/applications`) with duplicate guard, trial
cap (`lib/trial`), `ApplicationForm` enforcement (required cover letter / screening
questions / documents), frozen `snapshot`, `timeline`, notifications, webhook.

**Multi-company batch apply** (NEW, `POST /api/applications/batch`):

- Input: `{ jobIds: string[], coverLetter?, useProfile?: true }`.
- For each job, independently:
  - Skip if already applied (report `already_applied`).
  - Skip if the job's `ApplicationForm` requires documents or screening answers that a
    batch submit cannot satisfy generically → report `needs_manual` with the reason and
    a deep link to the full single-apply flow. **Employer-specific requirements are
    never bypassed.**
  - Otherwise create the `Application` from the candidate's current profile snapshot
    (+ optional shared cover letter), timeline, notifications, webhook — exactly the
    single-apply semantics.
- Enforce the trial cap across the *whole batch* (never exceed `TRIAL_APPLICATION_CAP`).
- Output: per-job `{ jobId, status: "applied" | "already_applied" | "needs_manual" |
  "capped" | "error", reason? }` plus a summary. The user reviews and approves the
  batch before it runs; nothing is auto-submitted without consent.

This satisfies "apply to one / selected / all eligible roles" while preserving
transparency, per-employer requirements, and honesty.

---

## 6. Recommendation Engine

- Ordering of groups and roles-within-group uses `rankJobs` / `lib/aios/recommend.rank`.
- Persisted recommendations use the existing `Recommendation` (+ `RecommendationFeedback`)
  models — `domain:"job"` or a new `domain:"group"`, with `context` carrying the
  explainability payload and `score`.
- Feedback (`helpful` / `accepted` / dismissed) feeds bounded weight calibration
  (`lib/career/calibration.ts`, `CAREER_CALIBRATE_WEIGHTS=on`).

---

## 7. Knowledge Graph

- Skill graph: `lib/career/taxonomy.ts` (`SKILLS`, aliases, `IMPLY`) + per-user graph
  persisted in `CareerProfile.graph` / time-series `CareerSnapshot`.
- Role graph: `lib/career/roles.ts` `FAMILIES` (IC / management / breadth ladders) +
  `lib/roleCatalog.ts` advertised catalog.
- Semantic document index: `lib/knowledge/semindex.ts` (`knowledge.search` capability),
  jobs indexed on `job.created/updated` events (`lib/knowledge/handlers.ts`).
- ICAE normalization is the bridge that ties a `Job` into both the skill graph
  (via required skills) and the role graph (via `roleFamily`/`seniority`).

---

## 8. Scoring Models (summary of the math, all in-house)

| Model | Where | Output | Notes |
|---|---|---|---|
| Skill confidence | `career/engine.proficiencies` | 0..1 per skill | evidence-weighted (claim/projectDepth/experience/frequency/recency) |
| Job match | `career/match.matchJob` | overall/technical 0..100 | `0.65*technical + 0.35*priority` coverage; funnel probabilities |
| Normalization confidence | `opportunity/normalize` (NEW) | 0..1 | alias hit strength + skill corroboration |
| Group cohesion | `opportunity/groups` (NEW) | 0..1 | share of jobs matching the group's roleKey+seniority + skill Jaccard |
| Rank score | `aios/recommend.rank` | 0..1 | weighted feature sum, bounded calibration |

---

## 9. Explainability

Every recommendation carries a user-facing explanation (no internal reasoning dumps):

- **Why recommended** — plain sentence(s) from `MatchResult.why` + normalization
  ("These 4 employers are hiring for the same Backend Engineer role you match at 78%").
- **Evidence** — matched skills with the candidate's demonstrated level.
- **Confidence** — `MatchResult.confidence`, shown as a qualitative band.
- **Missing requirements** — `MatchResult.missing` (skill, difficulty, prep days).
- **Risks / next steps** — trial cap, per-job manual requirements, top gap to close.

---

## 10. Implementation Tracker

Legend: ✅ shipped · �driving now · ⬜ planned.

| # | Item | Status | Location |
|---|---|---|---|
| 1 | Master spec (this doc) | ✅ | `docs/recruitment/INTELLIGENT_CAREER_APPLICATION_ENGINE.md` |
| 2 | Role/title normalization | ✅ | `lib/opportunity/normalize.ts` (33 unit tests) |
| 3 | Related opportunity groups | ✅ | `lib/opportunity/groups.ts` |
| 4 | Groups API (discovery + readiness + why) | ✅ | `app/api/opportunities/groups/route.ts` |
| 5 | Multi-company batch apply | ✅ | `app/api/applications/batch/route.ts` |
| 6 | Opportunities UI (group-first, multi-apply) | ✅ | `app/opportunities/page.tsx` |
| 7 | Nav entry + capability gating | ✅ | `components/vrittih/AppShell.tsx` (IconLayers) |
| 8 | Autonomous discovery (persist Recommendations, cron) | ✅ | `app/api/cron/discover` (07:00 UTC) + `Recommendation` |
| 9 | Career Intelligence dashboard extensions | ⬜ | `app/career/*` (extend existing) |
| 10 | Reconcile the 3 legacy scorers onto `career/match` | ⬜ | `lib/matching.ts`, `app/api/jobs/match` |

The intelligence core (skills, DNA, match, frontier, simulator, interview prep,
roadmap, coach) is **already shipped** under `lib/career/*` and is reused, not rebuilt.

---

## 11. Design Decision Records

- **DDR-1: No fourth scorer.** ICAE reuses `career/match.matchJob`. Rationale: three
  scorers already exist; adding a fourth worsens the divergence. Consolidation is
  tracked as item #10, not part of the ICAE happy path.
- **DDR-2: Normalization is derived, not stored (v1).** Computed at read time from
  the owned taxonomy. Rationale: avoids a migration + backfill + staleness while the
  taxonomy is still evolving. If profiling shows it's hot, cache to a `Job` column in v2
  (see Migration Notes).
- **DDR-3: Batch apply never bypasses employer requirements.** Jobs whose form needs
  documents/answers a generic batch can't provide are reported `needs_manual`, not
  auto-submitted with blanks. Rationale: honesty + employer trust.
- **DDR-4: Human-approved batches only.** ICAE proposes; the user selects and confirms
  before any application is created. Rationale: the "autonomous" brief is about
  discovery and preparation, not unattended submission.
- **DDR-5: Groups are the primary object.** The UI is group-first (opportunity groups),
  postings are the leaves. Rationale: the core product thesis.

---

## 12. Known Gaps

- Three match scorers coexist (`lib/matching.ts`, `lib/career/match.ts`, inline
  `app/api/jobs/match`). ICAE standardizes on `career/match`; full consolidation is
  future work (#10).
- `Job` has no stored normalized role/category/seniority columns; normalization is
  recomputed per read (DDR-2).
- Autonomous discovery is initially on-demand (computed when the user opens
  `/opportunities`); a scheduled cron that persists `Recommendation`s and notifies is
  the next increment.
- Batch apply currently targets jobs that either use the profile or need only a shared
  cover letter; document/assessment-gated jobs route to manual apply.

---

## 13. Dependencies

- Reuses: `lib/career/*`, `lib/aios/*`, `lib/knowledge/*`, `lib/prisma`, `lib/db.ci`,
  `lib/trial`, `lib/entitlements`, `lib/capability/*`, `lib/jwt`, `lib/notify`,
  `lib/webhooks`.
- Data: `Job`, `Application(+Form/Answer/Document/StatusEvent)`, `Recommendation(+Feedback)`,
  `CareerProfile/Snapshot`, `SavedJob`, `Skill/JobSkill`.
- No new third-party packages.

---

## 14. Verification

- **Unit** (pure libs): normalization correctness (equivalent titles → same roleKey;
  distinct roles stay distinct; seniority extraction), grouping (cohesion, no cross-family
  bleed), batch-apply decisioning (already_applied / needs_manual / capped / applied).
- **Integration**: groups endpoint returns readiness + why for a seeded user; batch
  endpoint respects trial cap and form requirements; duplicate guard holds.
- **Non-functional**: explainability present on every recommendation; accessibility &
  mobile responsiveness of `/opportunities`; performance (group discovery bounded to a
  candidate's top-N jobs); security (auth on every route); privacy (no cross-user leak;
  snapshot is the candidate's own).

Test harness convention: transpile the pure lib with `tsc` to the scratchpad, then run a
Node assertion script (see existing `lib/interview/governance` tests).

---

## 15. Roadmap

1. **v1 (this program):** normalization + groups + groups API + batch apply + group-first
   UI + nav. Discovery is on-demand.
2. **v1.1:** persist `Recommendation`s; `/api/cron/discover` scheduled sweep; notify on
   strong new matches; group dismissal + feedback → calibration.
3. **v1.2:** Career Intelligence dashboard extensions (opportunity pipeline, application
   funnel, readiness trends, priority opportunities, upcoming deadlines) on `/career`.
4. **v2:** cache normalization to `Job` columns; consolidate the three scorers; expand
   opportunity types (internships already native; scholarships/fellowships/competitions).

---

## 16. Migration Notes

- v1 adds **no** schema changes (normalization derived; batch apply reuses `Application`).
- v1.1 uses existing `Recommendation`/`RecommendationFeedback` (no migration).
- v2 (optional) would add `Job.roleKey/roleFamily/seniorityBand/primaryCategory` +
  backfill job — follow the standard dual-DB push dance (sqlite local, Postgres prod).

---

## 17. Changelog

- **2026-08-03** — Spec created. Architecture, AI design, unified opportunity model,
  matching/application/recommendation engines, knowledge graph, scoring models,
  explainability, tracker, DDRs, known gaps, dependencies, verification, roadmap,
  migration notes recorded.
- **2026-08-03** — v1 shipped: items #2–#8. Role/title normalization
  (`lib/opportunity/normalize.ts`, 33 tests) + related opportunity groups
  (`lib/opportunity/groups.ts`); groups discovery API with readiness/gap/why
  (`/api/opportunities/groups`); multi-company batch apply (`/api/applications/batch`);
  group-first UI (`/opportunities`) + nav (IconLayers); autonomous discovery cron
  (`/api/cron/discover`, daily 07:00 UTC) persisting `Recommendation`s and notifying
  candidates of strong new matches. No schema changes (normalization derived; batch
  reuses `Application`; discovery reuses `Recommendation`). Remaining: #9 dashboard
  extensions, #10 scorer consolidation.
