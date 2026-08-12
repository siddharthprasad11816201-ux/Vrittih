/**
 * Duplicate candidate resolution. PURE — deterministic scoring with explicit evidence.
 *
 * The governing rule (§53): NEVER merge merely because names match. A merge fuses two
 * people's hiring histories, résumés and interview transcripts — if it is wrong, that is a
 * privacy incident, not a data-quality blemish. So:
 *
 *   - only a STRONG IDENTIFIER can drive a merge (verified email, phone, LinkedIn, ID);
 *   - a name can only ever CORROBORATE, never carry a decision;
 *   - anything ambiguous goes to a human, and every verdict shows its evidence.
 */
import {
  IDENTITY_STRENGTH, UNVERIFIED_DISCOUNT, nameSimilarity, nameDistinctiveness,
  phonesMatch, type IdentityKind,
} from "./identity"

export interface Identity {
  kind: IdentityKind
  /** Already normalized via normalizeIdentity. */
  value: string
  verified?: boolean
}

export interface CandidateRecord {
  id: string
  name?: string | null
  identities: Identity[]
  /** Optional weak corroborators. */
  location?: string | null
  currentEmployer?: string | null
}

export interface MatchEvidence {
  kind: IdentityKind | "name" | "location" | "employer"
  detail: string
  weight: number
  /** True only for identifiers that can drive a merge on their own. */
  decisive: boolean
}

export type MatchVerdict = "SAME" | "REVIEW" | "DIFFERENT"

export interface MatchResult {
  verdict: MatchVerdict
  confidence: number          // 0..1
  evidence: MatchEvidence[]
  /** Present when the pair must not be auto-merged; explains what a human must check. */
  reviewReason?: string
}

/** A single identifier this strong is enough to merge without a human. */
export const AUTO_MERGE_THRESHOLD = 0.85
/** Below this there is nothing worth showing a human. */
export const REVIEW_THRESHOLD = 0.45

/** Identifier kinds that can, on their own, justify a merge. */
const DECISIVE_KINDS: ReadonlySet<IdentityKind> = new Set<IdentityKind>(["email", "phone", "linkedin", "national_id"])

function identitiesMatch(a: Identity, b: Identity): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === "phone") return phonesMatch(a.value, b.value)
  return a.value === b.value
}

/**
 * Compare two candidate records and explain the result.
 *
 * Confidence is the strongest single piece of evidence, nudged up by corroboration —
 * deliberately NOT a sum, because ten weak signals must never add up to a merge.
 */
export function compareCandidates(a: CandidateRecord, b: CandidateRecord): MatchResult {
  if (a.id && b.id && a.id === b.id) {
    return { verdict: "SAME", confidence: 1, evidence: [{ kind: "external", detail: "Same record", weight: 1, decisive: true }] }
  }

  const evidence: MatchEvidence[] = []
  let strongest = 0
  let hasDecisive = false

  for (const ia of a.identities || []) {
    for (const ib of b.identities || []) {
      if (!identitiesMatch(ia, ib)) continue
      const bothVerified = !!ia.verified && !!ib.verified
      const base = IDENTITY_STRENGTH[ia.kind] ?? 0.5
      const weight = +(base * (bothVerified ? 1 : UNVERIFIED_DISCOUNT)).toFixed(3)
      const decisive = DECISIVE_KINDS.has(ia.kind) && bothVerified
      if (decisive) hasDecisive = true
      strongest = Math.max(strongest, weight)
      evidence.push({
        kind: ia.kind,
        detail: `${ia.kind} matches (${bothVerified ? "both verified" : "unverified"}): ${maskValue(ia.kind, ia.value)}`,
        weight, decisive,
      })
    }
  }

  // --- corroboration only ---
  let corroboration = 0
  if (a.name && b.name) {
    const sim = nameSimilarity(a.name, b.name)
    if (sim >= 0.5) {
      const distinct = Math.min(nameDistinctiveness(a.name), nameDistinctiveness(b.name))
      const w = +(sim * distinct * 0.25).toFixed(3)   // capped: a name can never reach a merge
      corroboration += w
      evidence.push({ kind: "name", detail: `Names ${sim >= 0.99 ? "match" : "are similar"} (${sim})`, weight: w, decisive: false })
    }
  }
  if (a.location && b.location && a.location.trim().toLowerCase() === b.location.trim().toLowerCase()) {
    corroboration += 0.05
    evidence.push({ kind: "location", detail: `Same location: ${a.location}`, weight: 0.05, decisive: false })
  }
  if (a.currentEmployer && b.currentEmployer && a.currentEmployer.trim().toLowerCase() === b.currentEmployer.trim().toLowerCase()) {
    corroboration += 0.08
    evidence.push({ kind: "employer", detail: `Same employer: ${a.currentEmployer}`, weight: 0.08, decisive: false })
  }

  // Corroboration can lift a strong identifier over the line, but on its own it is capped
  // well below the review threshold — so name+location alone can never even reach REVIEW.
  const confidence = +Math.min(1, strongest > 0 ? strongest + corroboration * 0.5 : corroboration * 0.5).toFixed(3)

  evidence.sort((x, y) => y.weight - x.weight)

  if (hasDecisive && confidence >= AUTO_MERGE_THRESHOLD) {
    return { verdict: "SAME", confidence, evidence }
  }
  if (confidence >= REVIEW_THRESHOLD) {
    return {
      verdict: "REVIEW",
      confidence,
      evidence,
      reviewReason: hasDecisive
        ? "A strong identifier matches but confidence is below the auto-merge bar — confirm these are the same person."
        : "No verified strong identifier matches. Confirm manually before merging; matching names are not proof.",
    }
  }
  return { verdict: "DIFFERENT", confidence, evidence }
}

/** Mask identifiers in human-facing evidence — a review queue must not leak full contacts. */
export function maskValue(kind: IdentityKind, value: string): string {
  const v = String(value || "")
  if (kind === "email") {
    const [l, d] = v.split("@")
    if (!d) return "***"
    return `${l.slice(0, 2)}***@${d}`
  }
  if (kind === "phone" || kind === "national_id") return v.length > 4 ? `***${v.slice(-4)}` : "***"
  return v.length > 24 ? v.slice(0, 24) + "…" : v
}

/** Find likely duplicates of `subject` among `pool`, best first. Never returns DIFFERENT. */
export function findDuplicates(subject: CandidateRecord, pool: CandidateRecord[]): { candidate: CandidateRecord; match: MatchResult }[] {
  return pool
    .filter((c) => c.id !== subject.id)
    .map((c) => ({ candidate: c, match: compareCandidates(subject, c) }))
    .filter((r) => r.match.verdict !== "DIFFERENT")
    .sort((x, y) => y.match.confidence - x.match.confidence)
}

/* ---------------- merge planning ---------------- */

export interface MergePlan {
  survivorId: string
  mergedId: string
  /** Identities to move onto the survivor (deduplicated). */
  identitiesToMove: Identity[]
  /** Attribution rows that MUST be preserved — never collapsed (§54). */
  preserveSourceCount: number
  warnings: string[]
}

/**
 * Plan a merge. The OLDER record survives so the longest history is kept, and every source
 * attribution is carried across rather than collapsed: losing "came from the AICTE campaign"
 * would destroy the reporting that justifies the channel.
 */
export function planMerge(
  a: { id: string; createdAt: Date; identities: Identity[]; sourceCount: number },
  b: { id: string; createdAt: Date; identities: Identity[]; sourceCount: number },
): MergePlan {
  const [survivor, merged] = a.createdAt <= b.createdAt ? [a, b] : [b, a]
  const have = new Set(survivor.identities.map((i) => `${i.kind}:${i.value}`))
  const identitiesToMove = merged.identities.filter((i) => !have.has(`${i.kind}:${i.value}`))

  const warnings: string[] = []
  // Two DIFFERENT verified values of a normally-unique identifier is a real red flag.
  for (const kind of ["national_id"] as IdentityKind[]) {
    const sv = survivor.identities.filter((i) => i.kind === kind && i.verified).map((i) => i.value)
    const mv = merged.identities.filter((i) => i.kind === kind && i.verified).map((i) => i.value)
    if (sv.length && mv.length && !mv.every((v) => sv.includes(v))) {
      warnings.push(`Conflicting verified ${kind} values — these may be different people.`)
    }
  }

  return {
    survivorId: survivor.id,
    mergedId: merged.id,
    identitiesToMove,
    preserveSourceCount: survivor.sourceCount + merged.sourceCount,
    warnings,
  }
}
