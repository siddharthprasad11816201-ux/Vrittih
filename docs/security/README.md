# Security — Documentation

**Purpose:** AuthN/Z, capability-driven authorization, encryption, proctoring integrity.

**Scope:** All specifications, contracts and implementation notes for this domain.

**Owner:** siddharthprasad (solo)

**Implementation status:** In-house auth ✅ (bcrypt/JWT/capabilities)

**Dependencies:** lib/capability/*, lib/hash, lib/jwt

**Architecture:** A specialised interface over the one Enterprise Brain (`lib/intelligence/deliberate.ts`) and shared platform services (AIOS, Knowledge Graph, Talent/Competency Graph, Workflow, Capability Framework, Design System). No duplicated AI.

**Related documents:** See ../architecture/ · [/docs/README.md](../README.md) · [/docs/ROADMAP.md](../ROADMAP.md) · [/docs/IMPLEMENTATION_TRACKER.md](../IMPLEMENTATION_TRACKER.md)

## Changelog
- 2026-08-06 — Directory README created (documentation-system bootstrap).
