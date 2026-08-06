# EduRankAI — Known Gaps, Technical Debt & Blockers

Honest running list. Update whenever a gap is found or closed.

## Blockers
- **Not deployed.** Every feature is local-only. Launch is an owner action: Vercel `DATABASE_URL` → Supabase transaction pooler (`:6543`, `pgbouncer=true&connection_limit=1`). Mitigation for the earlier `EMAXCONNSESSION` outage is already in `lib/prisma.ts`.

## Intelligence (P0 per AI Quality Recovery mandate)
- Only the **Recruiter Copilot** is rebuilt to expert grade through the brain. **Career Coach, Interview AI, Learning Tutor, Executive/HR Copilots** still need the same rebuild.
- Vertical "advisors" (Sales, Campus, Finance, Project) are deterministic rule engines — to be upgraded to route through `deliberate()` for full evidence/confidence/reflection parity.
- Enterprise Brain retrieval (context/knowledge/memory) is caller-supplied; a conversation engine + long-term memory wiring are pending.
- Career DNA is not yet a continuously-evolving evidence model across all signals.

## Product
- Managed-placement UIs missing: `/hire` (employer), `/get-placed` (candidate), HR desk. Candidate↔request auto-matching loop not wired.
- Phases 9–16 (Government, Healthcare, Marketplace, Analytics, Automation, Digital Twin, Autonomous AI, Global) — models staged for 9–11; unbuilt.

## Technical debt
- Dual DB provider (sqlite local / postgres prod) dance before each commit.
- Windows dev server locks the Prisma engine DLL — stop dev before `prisma generate`/`build`.
- Some vertical page styles use inline styles (harder to make responsive) — migrate to CSS classes as touched.

## Changelog
- 2026-08-06 — Created.
