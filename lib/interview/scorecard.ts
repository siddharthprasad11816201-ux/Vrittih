/* Interview scorecards + evaluation aggregation + bias signals. PURE, testable.
 *
 * EROS Module 6 (Interview Intelligence). Structured, competency-based interview
 * evaluation with an explainable panel roll-up and deterministic bias signals — no
 * protected-attribute data, no black box. Signals flag *process* risks (a split panel,
 * a non-differentiating rater, a lenient/severe outlier) that a hiring team should look
 * at before deciding. Every signal explains itself.
 */

export const RECOMMENDATIONS = ["STRONG_NO", "NO", "YES", "STRONG_YES"] as const
export type Recommendation = (typeof RECOMMENDATIONS)[number]
export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  STRONG_NO: "Strong no", NO: "No", YES: "Yes", STRONG_YES: "Strong yes",
}
// Recommendation → numeric for aggregation (1..4).
export const REC_VALUE: Record<Recommendation, number> = { STRONG_NO: 1, NO: 2, YES: 3, STRONG_YES: 4 }

// Default competencies (a hiring plan can override). Ratings are 1..4.
export const DEFAULT_COMPETENCIES = [
  { key: "technical", label: "Technical skill" },
  { key: "problem_solving", label: "Problem solving" },
  { key: "communication", label: "Communication" },
  { key: "culture", label: "Values & collaboration" },
  { key: "role_fit", label: "Role fit" },
] as const

export interface Scorecard {
  panelistId: string
  panelistName?: string
  ratings: Record<string, number>   // competencyKey → 1..4
  recommendation: Recommendation
  notes?: string
}

export interface BiasSignal {
  type: "split_panel" | "no_differentiation" | "lenient_outlier" | "severe_outlier" | "insufficient_panel" | "rating_recommendation_mismatch"
  severity: "high" | "medium" | "low"
  panelistId?: string
  note: string
}

export interface PanelResult {
  perCompetency: { key: string; label: string; mean: number; spread: number }[]
  overall: { mean: number; recommendation: Recommendation; consensus: number } // consensus 0..1
  decision: "advance" | "hold" | "reject"
  biasSignals: BiasSignal[]
  panelSize: number
  confidence: number
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 }
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
}
function nearestRec(v: number): Recommendation {
  const r = Math.max(1, Math.min(4, Math.round(v)))
  return (RECOMMENDATIONS.find(k => REC_VALUE[k] === r)) || "YES"
}

/* Aggregate a panel's scorecards into an explainable decision + bias signals. */
export function aggregatePanel(
  cards: Scorecard[],
  competencies: { key: string; label: string }[] = DEFAULT_COMPETENCIES as any,
): PanelResult {
  const panelSize = cards.length
  const biasSignals: BiasSignal[] = []

  // per-competency mean + spread
  const perCompetency = competencies.map(c => {
    const vals = cards.map(cd => cd.ratings?.[c.key]).filter((v): v is number => typeof v === "number")
    return { key: c.key, label: c.label, mean: +mean(vals).toFixed(2), spread: +stdev(vals).toFixed(2) }
  })

  // overall from recommendations
  const recVals = cards.map(cd => REC_VALUE[cd.recommendation] ?? 3)
  const overallMean = +mean(recVals).toFixed(2)
  const overallSpread = stdev(recVals)
  // consensus: 1 when all agree, decaying with spread (max meaningful spread ~1.5).
  // Undefined for a single rater — one opinion is not a consensus (avoids inflating a
  // solo panel to 1.0 confidence).
  const consensus = panelSize < 2 ? 0 : +Math.max(0, 1 - overallSpread / 1.5).toFixed(2)
  const recommendation = nearestRec(overallMean)
  const decision: PanelResult["decision"] = overallMean >= 3 ? "advance" : overallMean >= 2.34 ? "hold" : "reject"

  // ---- bias / process signals ----
  if (panelSize < 2) {
    biasSignals.push({ type: "insufficient_panel", severity: "medium", note: "Only one evaluation — a single rater's judgement carries the whole decision. Add a second interviewer." })
  }
  // split panel: strong disagreement on the overall recommendation
  if (panelSize >= 2 && (Math.max(...recVals) - Math.min(...recVals)) >= 2) {
    biasSignals.push({ type: "split_panel", severity: "high", note: `Panel is split (recommendations span ${RECOMMENDATION_LABEL[nearestRec(Math.min(...recVals))]}→${RECOMMENDATION_LABEL[nearestRec(Math.max(...recVals))]}). Reconcile before deciding.` })
  }
  // per-panelist checks
  const panelMean = mean(recVals)
  for (const cd of cards) {
    const rvals = Object.values(cd.ratings || {}).filter(v => typeof v === "number") as number[]
    // no differentiation: identical rating across all competencies (halo/horn)
    if (rvals.length >= 3 && stdev(rvals) === 0) {
      biasSignals.push({ type: "no_differentiation", severity: "low", panelistId: cd.panelistId, note: `${cd.panelistName || "A panelist"} gave the same rating on every competency — possible halo/horn effect; ask for specifics.` })
    }
    // recommendation vs ratings mismatch: strong rec but weak ratings or vice versa
    if (rvals.length) {
      const rm = mean(rvals)
      const rec = REC_VALUE[cd.recommendation] ?? 3
      if (Math.abs(rm - rec) >= 1.5) {
        biasSignals.push({ type: "rating_recommendation_mismatch", severity: "medium", panelistId: cd.panelistId, note: `${cd.panelistName || "A panelist"}'s overall recommendation (${RECOMMENDATION_LABEL[cd.recommendation]}) doesn't match their competency ratings (avg ${rm.toFixed(1)}/4).` })
      }
    }
    // leniency / severity outlier vs the rest of the panel
    if (panelSize >= 3) {
      const others = cards.filter(o => o.panelistId !== cd.panelistId).map(o => REC_VALUE[o.recommendation] ?? 3)
      const dev = (REC_VALUE[cd.recommendation] ?? 3) - mean(others)
      if (dev >= 1.5) biasSignals.push({ type: "lenient_outlier", severity: "medium", panelistId: cd.panelistId, note: `${cd.panelistName || "A panelist"} rates well above the rest of the panel — check for leniency.` })
      else if (dev <= -1.5) biasSignals.push({ type: "severe_outlier", severity: "medium", panelistId: cd.panelistId, note: `${cd.panelistName || "A panelist"} rates well below the rest of the panel — check for severity.` })
    }
  }

  // confidence grows with panel size and consensus
  const confidence = +Math.min(0.95, (Math.min(1, panelSize / 3) * 0.6 + consensus * 0.4)).toFixed(2)

  return { perCompetency, overall: { mean: overallMean, recommendation, consensus }, decision, biasSignals, panelSize, confidence }
}
