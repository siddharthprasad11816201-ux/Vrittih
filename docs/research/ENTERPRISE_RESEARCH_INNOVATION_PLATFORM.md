# Enterprise Research & Innovation Platform (ERIP) — Phase 3

**Status:** Living engineering specification — permanent source of truth for Phase 3.
**Owner:** Vrittih / EduRankAI. **Last updated:** 2026-08-04.

---

## 0. Mission

Manage the full research & innovation lifecycle — from a research idea → project →
outputs (papers, preprints, patents, datasets) → peer review → publication → citation —
plus grants and innovation challenges, and a research AI assistant. It reuses the shared
**knowledge graph** (`lib/knowledge` semantic index), the **competency graph** (research
competencies — outputs produce research‑competency evidence), the **community platform**
(research groups/communities via `ProfessionalSpace`), and the **AIOS gateway** (the
research assistant + all AI). One graph, end to end: what you research feeds the same
Talent Intelligence Graph that recruitment and learning use.

Hard constraints (inherited): fully in‑house (no external LLM/ML), capability‑driven
authz, honesty (evidence + confidence), reuse before build, prove with tests, deploy on
push, everything auditable.

---

## 1. Architecture

```
  Idea → ResearchProject → ResearchOutput (paper/preprint/patent/dataset) → Peer Review → Published → Citations
     │         │                   │                         │                    │            │
  competency  collaborators   knowledge index         ResearchReview        research      Citation graph
  (research)  (users)         (SemanticDoc)           (in-house aggregation) competency    (internal+external)
     └──────── Grants · Innovation Challenges · Research AI Assistant (AIOS) · Analytics · Research Graph ────────┘
```

New models: `ResearchProject`, `ResearchOutput`, `ResearchReview`, `Citation`, `Grant`,
`GrantApplication`, `InnovationChallenge`, `ChallengeSubmission`. New engines:
`lib/research/*` (lifecycle, peer‑review aggregation, citation metrics). Reuses
`lib/knowledge`, `lib/learning/competency`, `lib/career/roadmap`, `lib/aios`,
`ProfessionalSpace`, `Certificate`.

---

## 2. Capability Map (15 modules → exists / gap)

| # | Module | Status | Plan |
|---|---|---|---|
| 1 | Research Lifecycle | ▶ | `ResearchProject` lifecycle (Batch 1). |
| 2 | Publications | ▶ | `ResearchOutput` (paper/preprint/patent/dataset) (Batch 1). |
| 3 | Peer Review | ▶ | `ResearchReview` + in‑house aggregation (Batch 1). |
| 4 | Citation Intelligence | ▶ | `Citation` graph + metrics (h‑index‑like, in‑house) (Batch 1). |
| 5 | Research AI Assistant | ▶ | In‑house via AIOS `execute()` — literature search (knowledge index) + research roadmap (Batch 2). |
| 6 | Grant Management | ▶ | `Grant` + `GrantApplication` (Batch 2). |
| 7 | Innovation Challenges | ▶ | `InnovationChallenge` + `ChallengeSubmission` (Batch 2). |
| 8 | Innovation / Research Analytics | ▶ | Outputs/citations/review throughput + research capability index (Batch 2). |
| 9 | Literature Intelligence | ◐ | Reuses `lib/knowledge` semantic index over outputs. |
| 10 | Research Graph | ◐ | Citation + author + competency edges (Batch 1/2). |
| 11 | Research Groups | ◐ | Reuses `ProfessionalSpace`. |
| 12 | Research Communities | ◐ | Reuses `ProfessionalSpace`/community platform. |
| 13 | Patent Management | ◐ | `ResearchOutput` kind `patent` + status lifecycle. |
| 14 | Experiment Tracking | ◐ | Lightweight (output + notes); full ELN is future. |
| 15 | Laboratories | ⬜ | Out of near‑term scope (noted). |

---

## 3. DDRs

- **DDR‑1: Research feeds the same graph.** Outputs map to research competencies and are
  indexed into the knowledge graph — one Talent Intelligence Graph, not a silo.
- **DDR‑2: Peer review is human + governed + explainable.** Reviewers recommend with a
  score + comments; aggregation is deterministic; a human editor decides.
- **DDR‑3: Citation metrics in‑house.** h‑index‑like metrics computed deterministically
  from the citation graph; honest about sparse data.
- **DDR‑4: All AI via AIOS.** The research assistant runs through `execute()` (audited);
  literature retrieval reuses the semantic index; no external LLM.
- **DDR‑5: Capability‑gated.** Authors author, reviewers review (conflict‑of‑interest
  guard: never review your own output), funders post grants — all by capability.

## 4. Dependencies

`lib/knowledge/*`, `lib/learning/competency`, `lib/career/roadmap`, `lib/aios/*`,
`lib/capability/*`, `lib/prisma`, `lib/certificate`, `ProfessionalSpace`. No external pkgs.

## 5. Verification

Per batch: unit‑test pure engines; `npm run build`; dual‑DB migration; adversarial review
(find → verify → fix confirmed); deploy; doc sync.

## 6. Roadmap (batches)

1. **Batch 1 (now):** Research lifecycle + Publications + Peer Review + Citation
   Intelligence — models, `lib/research/*`, APIs, `/research` UI.
2. **Batch 2:** Research AI Assistant (AIOS) + Grants + Innovation Challenges + Research
   Analytics + Research Graph.
3. **Completion Report** + go/no‑go; groups/communities/patents/experiments mapped to
   reused systems.

## 7. Changelog

- **2026-08-04** — Spec created (competency/knowledge‑graph‑connected, 15‑module map,
  DDRs, roadmap).
- **2026-08-04** — **ERIP shipped** (single build): research lifecycle + publications +
  peer review + citation intelligence + grants + innovation challenges + research AI
  assistant + research analytics; groups/communities/patents/experiments mapped to reused
  systems. Adversarial review run. **Production readiness: GO** —
  see `docs/research/ERIP_COMPLETION_REPORT.md`. Next: Phase 4 (Enterprise HRMS &
  Workforce Lifecycle).
