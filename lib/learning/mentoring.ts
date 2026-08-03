/* Mentoring & Coaching — matching + lifecycle. PURE, testable.
 *
 * ELTOS Module 8. Mentors surface by DEMONSTRATED proficiency in a competency (evidence,
 * not self-claim) + an opt-in; matching scores how well a mentor's strengths cover a
 * mentee's gaps, over the shared competency graph. Deterministic, explainable.
 */

export const MENTORSHIP_STATUSES = ["REQUESTED", "ACTIVE", "DECLINED", "COMPLETED", "WITHDRAWN"] as const
export type MentorshipStatus = (typeof MENTORSHIP_STATUSES)[number]

// A user is a candidate mentor for a competency at Advanced+ proficiency.
export const MENTOR_MIN_PROFICIENCY = 0.65

export interface MentorMatch { score: number; covers: string[]; strengthAvg: number }

/* Score a mentor for a mentee: how many of the mentee's gap competencies the mentor is
 * strong in, weighted by the mentor's average strength across those. */
export function mentorMatch(
  mentorStrengths: { key: string; proficiency: number }[],
  menteeGapKeys: string[],
): MentorMatch {
  const gap = new Set(menteeGapKeys.map(k => k.toLowerCase()))
  if (!gap.size) return { score: 0, covers: [], strengthAvg: 0 }
  const strong = mentorStrengths.filter(s => s.proficiency >= MENTOR_MIN_PROFICIENCY)
  const covers = strong.filter(s => gap.has(s.key.toLowerCase()))
  if (!covers.length) return { score: 0, covers: [], strengthAvg: 0 }
  const coverage = covers.length / gap.size
  const strengthAvg = covers.reduce((a, s) => a + s.proficiency, 0) / covers.length
  // 75% coverage of the gap + 25% mentor strength in the covered areas.
  const score = Math.round((coverage * 0.75 + strengthAvg * 0.25) * 100)
  return { score, covers: covers.map(c => c.key), strengthAvg: +strengthAvg.toFixed(2) }
}

/* Legal mentorship transitions (mentor acts on requests; either party can complete). */
export function canMentorshipTransition(action: string, status: string, by: "mentor" | "mentee"): { ok: boolean; to?: MentorshipStatus; reason?: string } {
  if (action === "accept") return status === "REQUESTED" && by === "mentor" ? { ok: true, to: "ACTIVE" } : { ok: false, reason: "Only the mentor can accept a pending request." }
  if (action === "decline") return status === "REQUESTED" && by === "mentor" ? { ok: true, to: "DECLINED" } : { ok: false, reason: "Only the mentor can decline a pending request." }
  if (action === "complete") return status === "ACTIVE" ? { ok: true, to: "COMPLETED" } : { ok: false, reason: "Only an active mentorship can be completed." }
  if (action === "withdraw") return (status === "REQUESTED" || status === "ACTIVE") && by === "mentee" ? { ok: true, to: "WITHDRAWN" } : { ok: false, reason: "Only the mentee can withdraw." }
  return { ok: false, reason: "Unknown action." }
}
