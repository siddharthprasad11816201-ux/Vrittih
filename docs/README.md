# EduRankAI — Documentation Index

The entry point for every engineer, AI agent, architect, reviewer and contributor. Read this first.

---

## Core documents (read in this order)

1. **[PLATFORM_CONSTITUTION.md](PLATFORM_CONSTITUTION.md)** — vision, philosophy, the managed model, the Enterprise Brain, the AI quality bar. **Highest authority.**
2. **[ROADMAP.md](ROADMAP.md)** — every phase, current/next, completion %, milestones, risks, production-readiness.
3. **[IMPLEMENTATION_TRACKER.md](IMPLEMENTATION_TRACKER.md)** — per-module engineering status (tests, reviews, gaps, next action).
4. This index.

## Governing directives (P0, permanent)
- The Constitution supersedes feature-first development.
- **EAIL** — every AI capability routes through the unified deliberation pipeline; evidence-based, explainable, no fake AI.
- **AI Quality Recovery** — pause *new AI features*; rebuild existing AI to expert grade. Infra/security/bug-fixes/stability continue.

## Platform architecture map

```
                         ┌──────────────────────────────────────────┐
   Employers / Individuals│         Interfaces (business modules)     │
        │                 │ Recruitment · Learning · Research · HRMS  │
        ▼                 │ Projects · ERP · CRM · University · …      │
   describe requirement / └───────────────┬──────────────────────────┘
   aspiration                             │  every AI decision
                                          ▼
                          ┌──────────────────────────────────────────┐
                          │  Enterprise Brain — lib/intelligence/     │
                          │  deliberate()  (via AIOS gateway, audited)│
                          │  reason · evaluate · recommend · reflect  │
                          └───────────────┬──────────────────────────┘
                                          ▼
      AIOS · Knowledge Graph · Talent/Competency Graph · Capability Framework · Workflow · Design System
```

## Master specifications (by domain)
- Recruitment OS — [recruitment/ENTERPRISE_RECRUITMENT_OS.md](recruitment/ENTERPRISE_RECRUITMENT_OS.md) · [ICAE](recruitment/INTELLIGENT_CAREER_APPLICATION_ENGINE.md)
- Learning & Talent Dev — [learning/ENTERPRISE_LEARNING_TALENT_DEVELOPMENT_OS.md](learning/ENTERPRISE_LEARNING_TALENT_DEVELOPMENT_OS.md)
- Research & Innovation — [research/ENTERPRISE_RESEARCH_INNOVATION_PLATFORM.md](research/ENTERPRISE_RESEARCH_INNOVATION_PLATFORM.md)
- HRMS / Workforce — [hrms/ENTERPRISE_HRMS_WORKFORCE_OS.md](hrms/ENTERPRISE_HRMS_WORKFORCE_OS.md)
- Project & Collaboration — [projects/EPCOS_COMPLETION_REPORT.md](projects/EPCOS_COMPLETION_REPORT.md)
- ERP (Finance) — [erp/EERP_COMPLETION_REPORT.md](erp/EERP_COMPLETION_REPORT.md)
- AI / Self-evolving intelligence — [ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md](ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md)
- Enterprise Intelligence — [intelligence/ENTERPRISE_INTELLIGENCE_PLATFORM.md](intelligence/ENTERPRISE_INTELLIGENCE_PLATFORM.md)
- Capability architecture — [enterprise/ENTERPRISE_CAPABILITY_ARCHITECTURE.md](enterprise/ENTERPRISE_CAPABILITY_ARCHITECTURE.md)
- Design system — [design/ENTERPRISE_DESIGN_SYSTEM.md](design/ENTERPRISE_DESIGN_SYSTEM.md)

## Implementation phase (current)
- **Completed:** Phases 1–8 (Recruitment, Learning, Research, HRMS, Projects, ERP, CRM, University) + Phase 5/6 intelligence.
- **Active:** **EAIL** — Enterprise Brain built (`deliberate()`); flagship **Recruiter Copilot** rebuilt through it. Rebuilding remaining copilots (Career Coach, Interview AI, Tutor, Executive) to expert grade.
- **Upcoming:** Phases 9–16 (Government, Healthcare, AI Marketplace, Analytics/BI, Automation, Digital Twin, Autonomous AI, Global Platform) — built *on top of* the brain, not as heuristic shells.

## Rules for updating documentation
- Every implementation updates [IMPLEMENTATION_TRACKER.md](IMPLEMENTATION_TRACKER.md) and, if phase-level, [ROADMAP.md](ROADMAP.md).
- **Never overwrite completed sections; append a Changelog entry.** Docs and code must never diverge.
- Any new spec under `/docs` is added to this index.
- Be honest: record known gaps and "not deployed" status truthfully.

## AI implementation workflow
1. Read Constitution + relevant master spec. 2. Retrieve real evidence (context/knowledge/memory/competency). 3. Route the decision through `deliberate()` (never heuristics-as-AI). 4. Return why/evidence/confidence/alternatives/risks. 5. Self-evaluate (would an expert agree?). 6. Test (unit + live E2E through the gateway). 7. Adversarial review. 8. Update tracker + changelog.

## Coding standards
- Fully in-house (no external LLM/ML/vector-DB — patent goal). Capability-driven authz (never role strings). FX-safe money (per-currency, never summed). No emojis; own SVG icons. Local schema provider **must be sqlite** before commit (Vercel flips to postgresql on deploy). Prove every claim with real tests.

## Documentation standards
- Markdown only. Living documents. Preserve history. Changelog at the bottom of each. Cross-link.

## Review / Verification / Production-readiness workflows
- **Review:** architecture · reasoning · evidence · explainability · security · privacy · UX · accessibility · performance · domain-expert · regression.
- **Verification:** unit + E2E green; adversarial multi-agent review; confirmed defects fixed + re-verified.
- **Production readiness:** see the checklist in [ROADMAP.md](ROADMAP.md). Launch step (owner): Vercel `DATABASE_URL` → Supabase transaction pooler (`:6543`, `pgbouncer=true`).

## Changelog
- 2026-08-06 — Created core governance docs (Constitution, README, Roadmap, Tracker). Recorded EAIL brain + Recruiter Copilot flagship.
