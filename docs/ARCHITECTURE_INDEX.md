# EduRankAI — Architecture Index

Map of every subsystem and where it lives.

## The one brain
- **Enterprise Brain** — `lib/intelligence/deliberate.ts` — unified evidence-based reasoning. Invoked via AIOS gateway (`execute("intelligence.deliberate")`), audited (`AiRun`).
- **Cognitive engines** — `lib/aios/{reason,plan,reflect,evaluate,recommend}.ts`.
- **AIOS gateway** — `lib/aios/execute.ts` (capability resolution → safe-evolution → authz → provider → audit → event); registry `lib/aios/registry.ts`; providers `lib/aios/{providers,engine-providers,ops-providers,vertical-providers,intelligence-providers}.ts`.

## Shared services
- **Capability framework** — `lib/capability/*` (authz never by role string).
- **Knowledge graph / semantic index** — `lib/knowledge/*`.
- **Talent/Competency graph** — UserCompetency + `lib/learning/competency`, `lib/career/*`.
- **Identity/auth** — `lib/hash`, `lib/jwt`, `lib/cookies`, `lib/capability/context`.
- **Design system** — `styles/vrittih.css`, `components/vrittih/AppShell.tsx`.
- **DB** — `prisma/schema.prisma` (sqlite local / postgres prod), `lib/prisma.ts` (pool-safe).

## Business modules (interfaces over the brain)
Recruitment · Learning · Research · HRMS · Projects · ERP · CRM · University · (staged: Government, Healthcare, Marketplace).

## Data flow
User → interface (business module) → retrieve real evidence → `deliberate()` via gateway → evidence-based, explainable decision → action → audit/event → back to the brain (learning).

## Changelog
- 2026-08-06 — Created.
