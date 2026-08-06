/* Enterprise HCM — Workforce Intelligence. PURE, testable.
 *
 * Phase 6 (HCM OS). Turns each employee's REAL signals (tenure, latest performance rating,
 * goal progress, recognition recency, manager 1:1 recency, succession status) into evidence
 * Briefs the Enterprise Brain (lib/intelligence/deliberate) reasons over — producing
 * evidence-based, explainable, confidence-scored ATTRITION RISK and PROMOTION READINESS.
 * No external LLM; every conclusion cites its evidence. Extends the existing HRMS/EHWOS
 * data (Employee, PerformanceReview, Goal, Recognition, OneOnOne, SuccessionPlan) — no
 * duplicated architecture.
 */
import type { Brief } from "@/lib/intelligence/deliberate"

export interface EmployeeSignals {
  name: string
  tenureMonths: number
  latestRating: number | null        // most recent PerformanceReview.overall, 1..5
  goalsActive: number
  goalsAchieved: number
  avgGoalProgress: number             // 0..100 across active goals
  recognitions90d: number
  lastOneOnOneDays: number | null     // days since last 1:1 (null = never)
  inSuccessionPlan: boolean
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/* "Is this person at risk of leaving?" — support = risk signals, oppose = retention signals. */
export function attritionBrief(s: EmployeeSignals): Brief {
  const ev: Brief["evidence"] = []
  if (s.latestRating != null && s.latestRating <= 2) ev.push({ id: "perf-low", statement: `Low recent performance rating (${s.latestRating}/5)`, stance: "support", weight: 0.7, source: "performance" })
  else if (s.latestRating != null && s.latestRating >= 4) ev.push({ id: "perf-high", statement: `Strong performance rating (${s.latestRating}/5)`, stance: "oppose", weight: 0.5, source: "performance" })
  if (s.recognitions90d === 0) ev.push({ id: "reco-none", statement: "No recognition in the last 90 days", stance: "support", weight: 0.45, source: "recognition" })
  else if (s.recognitions90d >= 2) ev.push({ id: "reco-good", statement: `${s.recognitions90d} recognitions in 90 days`, stance: "oppose", weight: 0.4, source: "recognition" })
  if (s.lastOneOnOneDays == null || s.lastOneOnOneDays > 90) ev.push({ id: "1o1-stale", statement: s.lastOneOnOneDays == null ? "No 1:1 on record" : `No manager 1:1 in ${s.lastOneOnOneDays} days`, stance: "support", weight: 0.5, source: "one-on-one" })
  if (s.goalsActive > 0 && s.avgGoalProgress < 30) ev.push({ id: "goals-stalled", statement: `Goal progress stalled (${s.avgGoalProgress}%)`, stance: "support", weight: 0.4, source: "goals" })
  if (s.tenureMonths >= 24 && (s.latestRating ?? 0) >= 4 && !s.inSuccessionPlan) ev.push({ id: "flight-risk", statement: "High performer, 2y+ tenure, no succession/growth path on record", stance: "support", weight: 0.55, source: "succession" })
  return {
    role: "HR director",
    question: `Is ${s.name} at risk of attrition?`,
    context: [`Tenure ${s.tenureMonths}mo`, `${s.goalsActive} active goals`, s.inSuccessionPlan ? "in a succession plan" : "not in a succession plan"],
    evidence: ev,
    criteria: [
      { key: "engagement", label: "Engagement (perf + goals)", weight: 0.5, score: clamp(((s.latestRating ?? 3) / 5) * 0.6 + (s.avgGoalProgress / 100) * 0.4, 0, 1) },
      { key: "recognition", label: "Recognition", weight: 0.25, score: clamp(s.recognitions90d / 3, 0, 1) },
      { key: "attention", label: "Manager attention", weight: 0.25, score: s.lastOneOnOneDays == null ? 0.2 : clamp(1 - s.lastOneOnOneDays / 120, 0, 1) },
    ],
    reasoningThreshold: 0.12,
  }
}

/* "Is this person ready for promotion?" — support = readiness signals. */
export function promotionBrief(s: EmployeeSignals): Brief {
  const ev: Brief["evidence"] = []
  if (s.latestRating != null && s.latestRating >= 4) ev.push({ id: "perf", statement: `High performance rating (${s.latestRating}/5)`, stance: "support", weight: 0.7, source: "performance" })
  else if (s.latestRating != null && s.latestRating <= 2) ev.push({ id: "perf-low", statement: `Performance rating only ${s.latestRating}/5`, stance: "oppose", weight: 0.7, source: "performance" })
  if (s.goalsAchieved >= 2) ev.push({ id: "goals", statement: `${s.goalsAchieved} goals achieved`, stance: "support", weight: 0.5, source: "goals" })
  if (s.avgGoalProgress >= 80) ev.push({ id: "goal-prog", statement: `Strong goal delivery (${s.avgGoalProgress}%)`, stance: "support", weight: 0.4, source: "goals" })
  if (s.tenureMonths >= 18) ev.push({ id: "tenure", statement: `${s.tenureMonths}mo tenure in role`, stance: "support", weight: 0.35, source: "tenure" })
  else ev.push({ id: "tenure-low", statement: `Only ${s.tenureMonths}mo in role`, stance: "oppose", weight: 0.4, source: "tenure" })
  if (s.inSuccessionPlan) ev.push({ id: "succession", statement: "Named in a succession plan", stance: "support", weight: 0.5, source: "succession" })
  return {
    role: "HR director",
    question: `Is ${s.name} ready for promotion?`,
    context: [`Tenure ${s.tenureMonths}mo`, `${s.goalsAchieved} goals achieved`, `latest rating ${s.latestRating ?? "n/a"}`],
    evidence: ev,
    criteria: [
      { key: "performance", label: "Performance", weight: 0.5, score: clamp((s.latestRating ?? 3) / 5, 0, 1) },
      { key: "delivery", label: "Goal delivery", weight: 0.3, score: clamp(s.avgGoalProgress / 100, 0, 1) },
      { key: "readiness", label: "Tenure/readiness", weight: 0.2, score: clamp(s.tenureMonths / 24, 0, 1) },
    ],
  }
}
