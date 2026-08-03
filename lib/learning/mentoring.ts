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
  // Dedupe covered competencies by lowercased key (keep the strongest) so a caller-
  // supplied array with repeats can't inflate coverage/score past 100.
  const byKey = new Map<string, { key: string; proficiency: number }>()
  for (const s of mentorStrengths) {
    if (s.proficiency < MENTOR_MIN_PROFICIENCY) continue
    const k = s.key.toLowerCase()
    if (!gap.has(k)) continue
    const ex = byKey.get(k)
    if (!ex || s.proficiency > ex.proficiency) byKey.set(k, s)
  }
  const covers = Array.from(byKey.values())
  if (!covers.length) return { score: 0, covers: [], strengthAvg: 0 }
  const coverage = Math.min(1, covers.length / gap.size)
  const strengthAvg = covers.reduce((a, s) => a + s.proficiency, 0) / covers.length
  // 75% coverage of the gap + 25% mentor strength in the covered areas (capped at 100).
  const score = Math.min(100, Math.round((coverage * 0.75 + strengthAvg * 0.25) * 100))
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
