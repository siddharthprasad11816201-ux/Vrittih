# EduRankAI — Design Decision Records (DDRs)

Append-only. Each DDR: context → decision → consequences.

## DDR-001 — Fully in-house intelligence (no external LLM/ML)
**Context:** Patent goal + data privacy. **Decision:** All AI is in-house deterministic reasoning over platform data (argumentation, rubric eval, ranking, reflection); no GPT/Claude/vector-DB. **Consequences:** Honest, explainable, auditable; bounded to symbolic/statistical reasoning over real evidence — quality scales with data.

## DDR-002 — One Enterprise Brain; no duplicated AI
**Context:** EAIL/Constitution. **Decision:** Every AI capability routes through `deliberate()` via the AIOS gateway. **Consequences:** Shared reasoning, uniform explainability/audit; interfaces differ, intelligence is shared.

## DDR-003 — Evidence-based, honest confidence
**Decision:** No arbitrary scores or fabricated confidence; confidence is 0 with no evidence; every recommendation carries why/evidence/alternatives/risks. **Consequences:** Trustworthy; sometimes "insufficient evidence" instead of a guess (by design).

## DDR-004 — Capability-driven authorization (never role strings)
**Decision:** Authorize on capabilities from `lib/capability`. **Consequences:** Fine-grained, plan-tunable; enforced fail-closed.

## DDR-005 — FX-safe money
**Decision:** Monetary figures grouped per-currency, never summed across currencies; conversion is explicit (`lib/fx`). **Consequences:** Correct multi-currency finance/salary.

## DDR-006 — Local-first, sqlite→postgres dual provider
**Decision:** Develop/verify on sqlite locally; Vercel flips provider to postgresql on deploy. **Consequences:** Provider must be sqlite before commit; migrate dance documented.

## Changelog
- 2026-08-06 — Created with DDR-001..006.
