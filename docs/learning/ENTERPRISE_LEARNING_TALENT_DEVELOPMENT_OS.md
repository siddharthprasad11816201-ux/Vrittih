# Enterprise Learning, Competency & Talent Development OS (ELTOS)
## The Human Capability Operating System

**Status:** Living engineering specification — permanent source of truth for Phase 2.
**Owner:** Vrittih / EduRankAI. **Last updated:** 2026-08-03.

---

## 0. Mission & Foundational Principle

ELTOS is **not an LMS**. It is the Human Capability Operating System that continuously
develops people across their whole lifecycle (student → intern → employee → manager →
executive → alumni, plus faculty, researchers, partners, officials). It continuously
**identifies capability gaps, recommends improvement, measures growth, validates
competency with evidence, predicts future readiness, and guides lifelong development.**

**Foundational principle — never think in "Courses".** The atomic unit is the
**Competency**. Courses, lessons, projects, assessments, mentoring, research and real
work are all just *evidence‑producing learning experiences* that map onto competencies.
The competency graph is the spine; everything else hangs off it, and it is the **same
skill graph** that powers recruitment (ICAE/EROS) — one vocabulary, hire→develop end to end.

Hard constraints (inherited): fully in‑house (no external LLM/ML — deterministic,
explainable), capability‑driven authz, honesty (evidence + confidence, never fabricate),
reuse before build, prove with tests, deploy on push, everything auditable/observable.

---

## 1. Architecture

```
                       ┌──────────── COMPETENCY GRAPH (spine, Module 1) ───────────┐
                       │  Competency (kind, level bands, relationships, evidence)   │
                       │  ← maps to → skills (lib/career/taxonomy)                  │
                       └───────────────────────────┬───────────────────────────────┘
        evidence in ───────────────────────────────┼─────────────────────────── proficiency out
   ┌──────────┬───────────┬──────────┬─────────────┼───────────┬──────────┬────────────┐
   ▼          ▼           ▼          ▼             ▼           ▼          ▼            ▼
 Content    Learning    Assess-    Projects     Mentoring   Research   Community   Career/
 (M4)       Paths (M3)  ment (M6)  (M7)         (M8)        (M9)       (M10)       Leadership (M11/12)
   │          │           │          │             │           │          │            │
   └──────────┴───────────┴──────────┴──── UserCompetency proficiency roll-up ─────────┘
                                     │
                    Learning Intelligence (M2) · AI Tutor (M5, via AIOS) · Analytics (M13)
                                     │
                    Executive: Org Capability Index · Skill Intelligence · Forecast (M13)
```

Reuses: `lib/career/*` (taxonomy, roadmap, resources, frontier, match, progress,
`CareerSnapshot`), `lib/jobarch/jd.competenciesFor`, `lib/interview/scorecard`,
`lib/certificate` + `Certificate`, `Test`/`TestAttempt`, `lib/intelligence/*` (forecast/
score/decisions), `lib/aios/*` (tutor + all AI via `execute()`), `lib/knowledge/*`
(knowledge index), `lib/capability/*`. New: `lib/learning/*` engines + the LMS/competency
data models.

---

## 2. Capability Map (15 modules → exists / gap)

Legend: ✅ reuse · ◐ extend · ⬜ build · ▶ now.

| # | Module | Status | Where / plan |
|---|---|---|---|
| 1 | **Enterprise Competency Framework** | ✅ | `Competency` + `UserCompetency` (both DBs) + `lib/learning/competency.ts` (kinds, bands, gap analysis, org heatmap, evidence→proficiency; 15 tests) + curated default library (23 competencies × 8 kinds mapped to the skill graph). `/api/competencies` (library + self-assess + author/seed + target gap), `/api/competencies/heatmap` (exec), `/competencies` UI. |
| 2 | Learning Intelligence Engine | ◐ | Readiness/velocity/prediction from `CareerSnapshot`+forecast+gap. Batch 3/4. |
| 3 | Learning Path Engine | ◐ | `buildRoadmap` (gap→phased plan) → competency‑backed, course‑mapped paths. Batch 2. |
| 4 | Content Platform | ⬜ | Course/Lesson/Enrollment/LessonProgress mapped to competencies + approval + knowledge index. Batch 2. |
| 5 | AI Tutor | ⬜ | In‑house, via AIOS `execute()` — teach/QA/plan/quiz from knowledge index + resources + learner gap. Batch 3. |
| 6 | Assessment Platform | ✅ | `Test`/`TestAttempt` — reused; competency‑linked validation added. |
| 7 | Project‑Based Learning | ◐ | Reuse `resources.projectIdea` + profile; project→competency evidence. Batch 4. |
| 8 | Mentoring & Coaching | ◐ | Internship mentoring exists; add mentor discovery/matching (reuse similarity). Batch 4. |
| 9 | Research & Innovation Learning | ◐ | Research roadmaps reuse roadmap/frontier + knowledge index. Batch 4. |
| 10 | Community Learning | ◐ | Community/feed exists; learning communities layer. Batch 4. |
| 11 | Career Development | ✅ | ICAE/EROS + career simulator/DNA/coach — reused; surfaced in LXP. |
| 12 | Leadership Development | ◐ | Leadership competencies (Module 1) + paths. Batch 4. |
| 13 | Learning Analytics + Executive Capability Index | ⬜ | On competency roll‑up + `CareerSnapshot` + forecast. Batch 3. |
| 14 | Certifications | ✅ | `lib/certificate` + `Certificate` — competency‑linked credentials on completion. |
| 15 | Learning Experience Platform (LXP) | ⬜ | Learner dashboard: paths, recommendations, progress, goals, achievements. Batch 2/3. |

**Batch 1 (now): Module 1 — the Enterprise Competency Framework (the spine).**

---

## 3. Design Decision Records

- **DDR‑1: Competency‑first.** The competency graph is the atomic model; all learning
  experiences map to competencies and produce evidence. No course‑centric design.
- **DDR‑2: One graph with recruitment.** Competency skills reference `lib/career/taxonomy`
  — the same vocabulary EROS hires on. Talent Intelligence Graph, not a parallel one.
- **DDR‑3: Evidence → proficiency, honestly.** `UserCompetency` proficiency is computed
  from real evidence (assessments, completed learning, projects, endorsements) with a
  source + confidence; never self‑declared as fact.
- **DDR‑4: All AI via AIOS.** Tutor + recommendations + forecasts run through `execute()`
  (AiRun audit). In‑house/deterministic; no external LLM.
- **DDR‑5: Capability‑gated.** Authors author, learners learn, mentors mentor, executives
  see the capability index — all by capability, never role.

## 4. Dependencies

`lib/career/*`, `lib/jobarch/jd`, `lib/interview/scorecard`, `lib/certificate`,
`lib/intelligence/*`, `lib/aios/*`, `lib/knowledge/*`, `lib/capability/*`, `lib/prisma`.
New models: `Competency`, `UserCompetency`, then `Course`/`Lesson`/`Enrollment`/
`LessonProgress` (Batch 2). No external packages.

## 5. Verification

Per module: unit‑test pure engines; `npm run build`; dual‑DB migration; adversarial review
(find → verify → fix confirmed only); deploy; doc sync. Plus the ELTOS‑specific
**educational‑effectiveness** lens (are paths actually closing measured gaps?).

## 6. Roadmap (batches)

1. **Batch 1 (now):** Competency Framework — `Competency`/`UserCompetency`, graph + gap +
   org heatmap engine, APIs, `/competencies` UI.
2. **Batch 2:** Content Platform + Learning Path Engine + LXP learner dashboard.
3. **Batch 3:** AI Tutor (AIOS) + Learning Intelligence + Analytics + Capability Index.
4. **Batch 4:** Projects / Mentoring / Research / Community / Leadership + ELTOS
   Completion Report.

## 7. Known Gaps / Migration Notes

- Virtual Labs / Simulations / AR‑VR: out of near‑term scope (noted).
- New models added via the standard dual‑DB push dance (sqlite local, Postgres prod).
- Sparse learning data ⇒ honest low‑confidence analytics until usage accrues.

## 8. Repository Mapping

`lib/learning/*` (engines) · `app/api/competencies*`, `app/api/courses*`,
`app/api/learning/*`, `app/api/tutor*` · `app/competencies`, `app/academy`, `app/tutor`,
learner LXP · Prisma: `Competency`, `UserCompetency`, `Course`, `Lesson`, `Enrollment`,
`LessonProgress`.

## 9. Changelog

- **2026-08-03** — Spec created (competency‑first, 15‑module capability map, DDRs,
  roadmap, dependencies, verification, repository mapping). Batch 1 (Competency
  Framework) begins now.
