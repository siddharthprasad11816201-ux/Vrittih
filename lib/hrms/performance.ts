/* Performance & Development — OKR progress + review aggregation. PURE, testable.
 *
 * Phase 4. Deterministic OKR/goal progress and performance-review roll-up. Review
 * competency ratings become UserCompetency evidence (wired in the API), so performance
 * feeds the same graph as hiring/learning. No external services.
 */

export const GOAL_STATUSES = ["ACTIVE", "ACHIEVED", "MISSED", "DROPPED"] as const
export const REVIEW_STATUSES = ["DRAFT", "SUBMITTED", "ACKNOWLEDGED"] as const

export interface KeyResult { text: string; target: number; current: number; unit?: string }

/* OKR progress = mean of per-key-result attainment (current/target, capped at 1), %. */
export function okrProgress(keyResults: KeyResult[]): number {
  const krs = (keyResults || []).filter(k => Number(k.target) > 0)
  if (!krs.length) return 0
  const sum = krs.reduce((a, k) => a + Math.min(1, Math.max(0, Number(k.current) || 0) / Number(k.target)), 0)
  return Math.round((sum / krs.length) * 100)
}

export interface Rating { competencyKey: string; rating: number }  // rating 1..5
export interface ReviewRollup { overall: number; overallPct: number; ratedCompetencies: number; band: "Outstanding" | "Strong" | "Solid" | "Developing" | "Below" }

export function reviewRollup(ratings: Rating[]): ReviewRollup {
  const rs = (ratings || []).map(r => Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0)))).filter(n => n >= 1)
  if (!rs.length) return { overall: 0, overallPct: 0, ratedCompetencies: 0, band: "Below" }
  const mean = rs.reduce((a, b) => a + b, 0) / rs.length
  const overall = +mean.toFixed(2)
  const band: ReviewRollup["band"] = mean >= 4.5 ? "Outstanding" : mean >= 3.5 ? "Strong" : mean >= 2.5 ? "Solid" : mean >= 1.5 ? "Developing" : "Below"
  return { overall, overallPct: Math.round((mean / 5) * 100), ratedCompetencies: rs.length, band }
}

/* A review rating (1..5) → competency proficiency (0..1) for evidence. */
export function ratingToProficiency(rating: number): number {
  return +Math.max(0, Math.min(1, (Math.max(1, Math.min(5, rating)) - 0) / 5)).toFixed(2)
}
