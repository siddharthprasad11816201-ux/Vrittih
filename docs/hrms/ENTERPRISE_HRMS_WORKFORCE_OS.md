# Enterprise HRMS & Workforce Lifecycle OS (EHWOS) — Phase 4

**Status:** Living engineering specification. **Owner:** Vrittih / EduRankAI.
**Last updated:** 2026-08-04.

---

## 0. Mission

Manage the full employee lifecycle — hire → onboard → work → **grow (goals/OKRs, reviews,
1:1s, feedback, recognition)** → advance (promotion/transfer/succession) → offboard →
alumni. The HRMS **core already exists** (Employee, Attendance, Leave, Payroll, Payslip,
Compensation, Task). Phase 4 adds the **performance & development lifecycle** that was
missing, wired to the same competency graph: performance reviews rate competencies and
write **evidence**, so how someone performs feeds the one Talent Intelligence Graph that
recruitment (EROS), learning (ELTOS), and research (ERIP) share.

Hard constraints (inherited): fully in‑house, capability‑driven authz, honesty, reuse
before build, prove with tests, deploy on push, auditable.

---

## 1. Architecture

```
  Employee (exists) ── managerId ──► Org chart (derived)
     │
  Goal/OKR ── progress ──┐
  PerformanceReview ── competency ratings ──► UserCompetency evidence (ELTOS graph)
  OneOnOne · Recognition · SuccessionPlan
     │
  Offboarding (Employee.status EXITED + checklist) ──► Alumni (Talent pool ALUMNI)
```

New models: `Goal` (OKR), `PerformanceReview`, `OneOnOne`, `Recognition`,
`SuccessionPlan`; `Employee.exitedAt` + `offboarding` checklist. New engine:
`lib/hrms/performance.ts` (OKR progress, review aggregation). Reuses `Employee` + the
HRMS core, `lib/learning/competency`, `lib/capability`, `lib/notify`, `Certificate`.

---

## 2. Capability Map (Phase 4 modules → exists / gap)

| Module | Status |
|---|---|
| Employee Lifecycle · Attendance · Leave · Payroll · Compensation · Tasks | ✅ exists (reused) |
| Onboarding | ✅ exists (`Employee.onboarding`) |
| **Goals / OKRs** | ▶ build (`Goal`) |
| **Performance Reviews** | ▶ build (`PerformanceReview` → competency evidence) |
| **1:1 Meetings** | ▶ build (`OneOnOne`) |
| **Feedback / Recognition / Rewards** | ▶ build (`Recognition`) |
| **Promotion / Transfers** | ◐ recorded via review outcome + Employee updates (Batch 2) |
| **Succession** | ▶ build (`SuccessionPlan`) |
| **Organization Charts** | ◐ derived from `Employee.managerId` |
| **Offboarding** | ▶ `Employee.exitedAt` + offboarding checklist |
| **Alumni** | ◐ EXITED employees → Talent pool `ALUMNI` |

## 3. DDRs

- **DDR‑1: Extend the HRMS core, don't fork it.** Reuse `Employee` + existing models.
- **DDR‑2: Reviews feed the graph.** Competency ratings in a review write `UserCompetency`
  evidence (source `review`) — performance informs the same graph as hiring/learning.
- **DDR‑3: Manager scoping.** A manager acts on their reports; an employee on their own
  goals; HR/admin org‑wide — all by capability, never role strings.
- **DDR‑4: Deterministic + explainable** OKR progress + review aggregation; no LLM.

## 4. Dependencies

`Employee`/HRMS core, `lib/learning/competency`, `lib/capability/*`, `lib/prisma`,
`lib/notify`, `lib/talent/pools` (alumni). No external packages.

## 5. Roadmap

1. **Batch 1 (now):** Performance & Development — Goals/OKRs, Performance Reviews (→
   competency evidence), 1:1s, Recognition; `lib/hrms/performance.ts`; `/hrms/performance`.
2. **Batch 2:** Org chart (derived), Succession, Promotion/Transfer, Offboarding + Alumni;
   then the EHWOS Completion Report.

## 6. Verification

Per batch: unit‑test pure engines; `npm run build`; dual‑DB migration; adversarial review
(find → verify → fix); deploy; doc sync.

## 7. Changelog

- **2026-08-04** — Spec created. HRMS core mapped as existing; Phase 4 adds the
  performance & development lifecycle.
- **2026-08-04** — **EHWOS shipped** (single build): Goals/OKRs, Performance Reviews
  (→ competency evidence), 1:1s, Recognition, Succession, org chart (derived), offboarding
  fields; `lib/hrms/performance.ts`, `/api/hrms/performance` + `/api/hrms/org`,
  `/hrms/performance`. **Production readiness: GO** — see
  `docs/hrms/EHWOS_COMPLETION_REPORT.md`. Next: Phase 5 (Project & Collaboration).
