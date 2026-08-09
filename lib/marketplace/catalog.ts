/* Phase 11 — AI Marketplace catalog + pure helpers.
 *
 * The marketplace surfaces the platform's real in-house AIOS capabilities as
 * installable items. An AGENT item maps to a registered capId; running it goes
 * through the AIOS gateway (execute), which enforces the CALLER's own authz — so
 * installing an item never grants a capability the caller doesn't already hold.
 * Nothing here is a mock: every SEED entry points at a live capability in
 * lib/aios/registry.ts, and ratings/installs are computed from real rows. */

export type MarketKind = "AGENT" | "PROMPT" | "TOOL" | "WORKFLOW"
export const KINDS: MarketKind[] = ["AGENT", "PROMPT", "TOOL", "WORKFLOW"]
// Users may author these kinds; AGENT/TOOL are platform-governed (admin only) because
// they represent runnable capabilities, not free-text assets.
export const USER_KINDS: MarketKind[] = ["PROMPT", "WORKFLOW"]

export type RunField = { key: string; label: string; placeholder: string } | null

export type CatalogSeed = {
  slug: string
  name: string
  kind: MarketKind
  category: string
  summary: string
  capId: string          // must exist in lib/aios/registry.ts CAPABILITIES
  runField: RunField     // the single input the capability needs, or null if it runs off the caller's own data
}

/* The in-house agent catalog. Each capId is a real, gateway-executable capability. */
export const CATALOG: CatalogSeed[] = [
  { slug: "enterprise-brain", name: "Enterprise Brain", kind: "AGENT", category: "Reasoning",
    summary: "Unified evidence-based deliberation: verdict, honest confidence, evidence, risks, reflection and a plain-language explanation for any claim.",
    capId: "intelligence.deliberate", runField: { key: "claim", label: "Claim or question", placeholder: "e.g. This candidate is ready for a senior backend role" } },
  { slug: "ai-career-coach", name: "AI Career Coach", kind: "AGENT", category: "Career",
    summary: "Role readiness, skill-gap analysis and a market-demand-driven learning plan for a target role, grounded in live postings.",
    capId: "career.coach.readiness", runField: { key: "targetRole", label: "Target role", placeholder: "e.g. Machine Learning Engineer" } },
  { slug: "career-frontier", name: "Career Frontier", kind: "AGENT", category: "Career",
    summary: "The in-demand skill frontier for your profile computed from the live job market.",
    capId: "career.frontier", runField: null },
  { slug: "opportunity-matcher", name: "Opportunity Matcher", kind: "AGENT", category: "Career",
    summary: "Matches your profile to open employer requirements in the managed-placement pool, with evidence for each match.",
    capId: "candidate.opportunities", runField: null },
  { slug: "recruiter-copilot", name: "Recruiter Copilot", kind: "AGENT", category: "Recruiting",
    summary: "Evidence-ranked candidate shortlist for a hiring requirement, with salary band and interview plan — via the Enterprise Brain.",
    capId: "recruit.shortlist", runField: { key: "requestId", label: "Talent request id", placeholder: "TalentRequest id to shortlist for" } },
  { slug: "hr-copilot", name: "HR Copilot", kind: "AGENT", category: "Workforce",
    summary: "Attrition risk and promotion readiness for your workforce, each verdict deliberated with real performance evidence.",
    capId: "hr.copilot", runField: null },
  { slug: "ai-project-manager", name: "AI Project Manager", kind: "AGENT", category: "Operations",
    summary: "Portfolio standup: completion forecasts, schedule variance and risk bands across your projects from real task velocity.",
    capId: "project.manager", runField: null },
  { slug: "financial-intelligence", name: "Financial Intelligence", kind: "AGENT", category: "Finance",
    summary: "Cash-flow, AR-aging and budget forecasting over your real ledger — FX-safe, never summing across currencies.",
    capId: "finance.advisor", runField: null },
  { slug: "ai-sales-assistant", name: "AI Sales Assistant", kind: "AGENT", category: "Sales",
    summary: "Pipeline forecast and next-best-actions computed from your real deal history.",
    capId: "crm.sales.assistant", runField: null },
  { slug: "campus-intelligence", name: "Campus Intelligence", kind: "AGENT", category: "Education",
    summary: "Admissions funnel, placement outlook and at-risk-student signals for a university programme.",
    capId: "university.intelligence", runField: null },
  { slug: "policy-intelligence", name: "Policy Intelligence", kind: "AGENT", category: "Government",
    summary: "Grievance SLA risk and scheme-reach analysis for citizen services — FX-safe.",
    capId: "gov.policy.intelligence", runField: null },
  { slug: "clinical-ops-assistant", name: "Clinical Operations Assistant", kind: "AGENT", category: "Healthcare",
    summary: "Triage routing, no-show risk and population-health signals — operational, never diagnosis.",
    capId: "health.clinical.assistant", runField: null },
  { slug: "research-assistant", name: "Research Assistant", kind: "AGENT", category: "Research",
    summary: "Literature grounding and citation-aware assistance for your research outputs.",
    capId: "research.assistant", runField: { key: "query", label: "Research question", placeholder: "What do you want help reasoning about?" } },
  { slug: "ai-tutor", name: "AI Tutor", kind: "AGENT", category: "Learning",
    summary: "Gap-driven tutoring against your competency profile and enrolled courses.",
    capId: "learning.tutor", runField: { key: "topic", label: "Topic", placeholder: "e.g. Dynamic programming" } },
]

/* Honest rating average: null when there are no ratings (never a fake 0 or 5). */
export function ratingAvg(ratingSum: number, ratingCount: number): number | null {
  if (!ratingCount || ratingCount < 1) return null
  return +(ratingSum / ratingCount).toFixed(2)
}

/* Clamp a user-supplied rating to the 1..5 integer range. */
export function normalizeRating(n: any): number {
  const r = Math.round(Number(n))
  if (!Number.isFinite(r)) return 0
  return Math.max(1, Math.min(5, r))
}

export function slugify(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export function isUserKind(kind: string): kind is MarketKind {
  return (USER_KINDS as string[]).includes(kind)
}

export type PublishInput = { name?: string; kind?: string; summary?: string; category?: string; spec?: any }
export type PublishResult = { ok: true; name: string; kind: MarketKind; summary: string | null; category: string | null; spec: string }
  | { ok: false; error: string }

/* Validate a user-published item. Users may only publish PROMPT/WORKFLOW assets;
 * AGENT/TOOL are platform-governed and rejected here (the route additionally
 * requires admin for those). Returns normalized, size-capped fields. */
export function validatePublish(input: PublishInput): PublishResult {
  const name = String(input.name || "").trim()
  if (name.length < 3) return { ok: false, error: "A name of at least 3 characters is required." }
  if (name.length > 120) return { ok: false, error: "Name must be 120 characters or fewer." }
  const kind = String(input.kind || "").toUpperCase()
  if (!isUserKind(kind)) return { ok: false, error: "You can publish PROMPT or WORKFLOW items. Agents and tools are platform-governed." }
  let spec = "{}"
  if (input.spec != null) {
    try {
      const obj = typeof input.spec === "string" ? JSON.parse(input.spec) : input.spec
      spec = JSON.stringify(obj).slice(0, 20000)
    } catch {
      return { ok: false, error: "Spec must be valid JSON." }
    }
  }
  return {
    ok: true,
    name,
    kind: kind as MarketKind,
    summary: input.summary ? String(input.summary).slice(0, 2000) : null,
    category: input.category ? String(input.category).slice(0, 60) : null,
    spec,
  }
}
