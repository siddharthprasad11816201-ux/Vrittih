/* Research lifecycle + peer-review aggregation. PURE, testable.
 *
 * Phase 3, Modules 1–3. Projects and outputs move through governed states; peer reviews
 * aggregate deterministically into an editorial recommendation (a human editor decides).
 * No external services.
 */

export const PROJECT_STATUSES = ["PROPOSED", "ACTIVE", "COMPLETED", "ARCHIVED"] as const
export const OUTPUT_KINDS = ["paper", "preprint", "patent", "dataset", "report"] as const
export const OUTPUT_STATUSES = ["DRAFT", "UNDER_REVIEW", "PUBLISHED", "REJECTED", "WITHDRAWN"] as const
export type OutputStatus = (typeof OUTPUT_STATUSES)[number]

export const REVIEW_RECS = ["ACCEPT", "MINOR", "MAJOR", "REJECT"] as const
export type ReviewRec = (typeof REVIEW_RECS)[number]
export const REC_VALUE: Record<ReviewRec, number> = { REJECT: 1, MAJOR: 2, MINOR: 3, ACCEPT: 4 }

export type OutputAction = "submit" | "publish" | "reject" | "revise" | "withdraw"
const OUTPUT_TRANSITIONS: Record<OutputAction, { from: OutputStatus[]; to: OutputStatus }> = {
  submit:   { from: ["DRAFT"], to: "UNDER_REVIEW" },
  publish:  { from: ["UNDER_REVIEW"], to: "PUBLISHED" },
  reject:   { from: ["UNDER_REVIEW"], to: "REJECTED" },
  revise:   { from: ["UNDER_REVIEW", "REJECTED"], to: "DRAFT" },
  withdraw: { from: ["DRAFT", "UNDER_REVIEW"], to: "WITHDRAWN" },
}

export function canOutputTransition(action: OutputAction, status: string, opts?: { isEditor?: boolean }): { ok: boolean; to?: OutputStatus; reason?: string } {
  const t = OUTPUT_TRANSITIONS[action]
  if (!t) return { ok: false, reason: "Unknown action." }
  if (!t.from.includes(status as OutputStatus)) return { ok: false, reason: `Cannot ${action} an output that is ${status}.` }
  // Editorial decisions (publish/reject) require an editor (not the author) — enforced by the API.
  if ((action === "publish" || action === "reject") && opts && opts.isEditor === false) {
    return { ok: false, reason: "Only an editor may publish or reject." }
  }
  return { ok: true, to: t.to }
}

export interface Review { recommendation: ReviewRec; score?: number }
export interface ReviewAggregate {
  count: number
  meanRec: number                 // 1..4
  meanScore: number | null        // if scores present (0..10)
  recommendation: "accept" | "minor_revisions" | "major_revisions" | "reject" | "insufficient"
  consensus: number               // 0..1
  distribution: Record<ReviewRec, number>
}

/* Aggregate peer reviews into an editorial recommendation. Deterministic; advisory only
 * (a human editor makes the call). */
export function aggregateReviews(reviews: Review[]): ReviewAggregate {
  const distribution = { REJECT: 0, MAJOR: 0, MINOR: 0, ACCEPT: 0 } as Record<ReviewRec, number>
  for (const r of reviews) if (distribution[r.recommendation] != null) distribution[r.recommendation]++
  const n = reviews.length
  if (n < 2) {
    const meanRec = n ? REC_VALUE[reviews[0].recommendation] : 0
    return { count: n, meanRec, meanScore: null, recommendation: "insufficient", consensus: n ? 1 : 0, distribution }
  }
  const recVals = reviews.map(r => REC_VALUE[r.recommendation] ?? 3)
  const meanRec = recVals.reduce((a, b) => a + b, 0) / n
  const scores = reviews.map(r => r.score).filter((s): s is number => typeof s === "number")
  const meanScore = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null
  // spread → consensus
  const mean = meanRec
  const sd = Math.sqrt(recVals.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
  const consensus = +Math.max(0, 1 - sd / 1.5).toFixed(2)
  const recommendation = meanRec >= 3.5 ? "accept" : meanRec >= 2.75 ? "minor_revisions" : meanRec >= 1.75 ? "major_revisions" : "reject"
  return { count: n, meanRec: +meanRec.toFixed(2), meanScore, recommendation, consensus, distribution }
}
