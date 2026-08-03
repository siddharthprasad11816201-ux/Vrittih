/* AIOS §14 — verified-learning classifier. Assigns a governance status to a
 * knowledge object from its PROVENANCE, never from model output. Only trusted,
 * corroborated internal records become `verified` (retrievable-as-fact). Raw user
 * prompts / opinions / AI speculation never become verified.
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §14. */

export type KnowledgeStatus = "verified" | "unverified" | "pending_review" | "experimental" | "deprecated" | "rejected"
export type Provenance = { source: string; trust?: "system" | "employer" | "user" | "ai" | "external"; corroborated?: boolean }

// Source kinds whose records are authoritative internal data (real DB rows).
const TRUSTED_SYSTEM = new Set(["job", "application", "company", "skill", "official-policy", "structured", "outcome"])

export function classifyKnowledge(kind: string, provenance: Provenance): { status: KnowledgeStatus; confidence: number } {
  const trust = provenance.trust || "user"
  // Authoritative internal records — verified.
  if (trust === "system" || TRUSTED_SYSTEM.has(kind)) return { status: "verified", confidence: 0.95 }
  // Employer/official content — verified once corroborated, else pending human review.
  if (trust === "employer" || trust === "external") return provenance.corroborated ? { status: "verified", confidence: 0.8 } : { status: "pending_review", confidence: 0.5 }
  // AI-derived — experimental at best; NEVER auto-verified (§27).
  if (trust === "ai") return { status: "experimental", confidence: 0.3 }
  // User-submitted — unverified until reviewed. Never learned as fact from a prompt.
  return { status: "unverified", confidence: 0.3 }
}

/** Only these statuses are retrievable as fact by reasoning. */
export const FACT_STATUSES: KnowledgeStatus[] = ["verified"]
export const isFact = (s: string) => (FACT_STATUSES as string[]).includes(s)
