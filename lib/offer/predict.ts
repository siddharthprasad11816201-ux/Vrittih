/* Offer-acceptance prediction — in-house, deterministic, EXPLAINABLE. PURE, testable.
 *
 * No black box, no external ML. A transparent factor model: start from a base rate and
 * adjust for signals we actually have — how well the candidate fits the role (they want
 * roles they match), whether the compensation is spelled out, and whether the response
 * window is reasonable. Every prediction returns the factors that moved it and an
 * honest confidence tied to how much signal was available. Where we lack a signal
 * (e.g. market salary benchmark), we say so rather than inventing it.
 */

export interface PredictInput {
  matchScore?: number | null    // 0..100 candidate↔role fit (from lib/career/match), if known
  hasBaseComp?: boolean         // is base compensation stated?
  hasBonusOrEquity?: boolean    // upside stated?
  responseWindowDays?: number | null // days until the offer expires
  benefitsCount?: number        // number of listed benefits
}

export interface PredictFactor { label: string; effect: number; note: string }  // effect in score points
export interface Prediction {
  score: number            // 0..1 predicted acceptance
  band: "Likely" | "Uncertain" | "At risk"
  factors: PredictFactor[]
  confidence: number       // 0..1 — how much real signal fed the estimate
  note: string
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function predictAcceptance(input: PredictInput): Prediction {
  // Base rate: a sent, complete offer is accepted more often than not.
  let s = 0.55
  const factors: PredictFactor[] = []
  let signals = 0

  if (input.matchScore != null && Number.isFinite(input.matchScore)) {
    signals++
    // Fit centred at 60: strong fit lifts, weak fit drops (±0.2 across 0..100).
    const eff = clamp01(input.matchScore / 100) * 0.4 - 0.2
    s += eff
    factors.push({ label: "Role fit", effect: +(eff * 100).toFixed(0), note: `Candidate–role match ${Math.round(input.matchScore)}%.` })
  }

  if (input.hasBaseComp != null) {
    signals++
    const eff = input.hasBaseComp ? 0.08 : -0.15
    s += eff
    factors.push({ label: "Base compensation", effect: +(eff * 100).toFixed(0), note: input.hasBaseComp ? "Base pay is stated." : "No base pay stated — a major acceptance risk." })
  }
  if (input.hasBonusOrEquity) {
    signals++
    s += 0.05
    factors.push({ label: "Upside (bonus/equity)", effect: 5, note: "Bonus or equity strengthens the offer." })
  }
  if (input.benefitsCount && input.benefitsCount > 0) {
    signals++
    const eff = Math.min(0.06, input.benefitsCount * 0.015)
    s += eff
    factors.push({ label: "Benefits", effect: +(eff * 100).toFixed(0), note: `${input.benefitsCount} benefit${input.benefitsCount > 1 ? "s" : ""} listed.` })
  }

  if (input.responseWindowDays != null && Number.isFinite(input.responseWindowDays)) {
    signals++
    let eff = 0
    let note = ""
    if (input.responseWindowDays < 2) { eff = -0.1; note = "Very short window pressures the candidate — raises decline/no-response risk." }
    else if (input.responseWindowDays > 21) { eff = -0.05; note = "A long window invites competing offers." }
    else { eff = 0.04; note = "Response window is reasonable." }
    s += eff
    factors.push({ label: "Response window", effect: +(eff * 100).toFixed(0), note })
  }

  const score = +clamp01(s).toFixed(2)
  const band = score >= 0.66 ? "Likely" : score >= 0.45 ? "Uncertain" : "At risk"
  // Confidence grows with how many real signals fed the estimate (5 possible).
  const confidence = +Math.min(0.9, 0.3 + signals * 0.12).toFixed(2)
  const note = input.matchScore == null
    ? "No role-fit signal available — attach the application for a sharper estimate. Market salary benchmarking is not modelled (no dataset)."
    : "Deterministic factor estimate; market salary benchmarking is not modelled (no dataset)."
  return { score, band, factors: factors.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)), confidence, note }
}
