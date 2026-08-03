/* AIOS §18 — the Recommendation Engine. In-house, deterministic multi-signal
 * ranking with human-readable reasons, plus outcome-driven weight calibration.
 * NO LLM, NO model-weight training (DDR-001): calibration adjusts recommendation
 * STRATEGY weights from REAL observed feedback (accept/dismiss) — bounded,
 * deterministic, auditable — exactly like lib/career/calibration. Recommendations
 * persist to `Recommendation`; feedback to `RecommendationFeedback` (schema shipped).
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §18. */

export type Candidate = { id: string; features: Record<string, number>; meta?: any }  // feature values 0..1
export type Reason = { feature: string; value: number; weight: number; contribution: number }
export type Ranked = { id: string; score: number; reasons: Reason[]; why: string; meta?: any }

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const prettify = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase()

/** Rank candidates by weighted feature signals. Score is normalized to 0..1 over
 * the supplied weights so it's comparable across different weight sets. */
export function rank(candidates: Candidate[], weights: Record<string, number>, opts: { topReasons?: number } = {}): Ranked[] {
  const topReasons = opts.topReasons ?? 3
  const featureKeys = Object.keys(weights).filter((k) => weights[k] > 0)
  const denom = featureKeys.reduce((s, k) => s + weights[k], 0) || 1

  return (candidates || []).map((c) => {
    const reasons: Reason[] = featureKeys.map((k) => {
      const value = clamp01(c.features?.[k] ?? 0)
      return { feature: k, value, weight: weights[k], contribution: (weights[k] * value) / denom }
    }).sort((a, b) => b.contribution - a.contribution)
    const score = clamp01(reasons.reduce((s, r) => s + r.contribution, 0))
    const top = reasons.filter((r) => r.value > 0).slice(0, topReasons)
    const why = top.length
      ? `Strong on ${top.map((r) => `${prettify(r.feature)} (${Math.round(r.value * 100)}%)`).join(", ")}`
      : "No positive signals for this candidate"
    return { id: c.id, score, reasons: reasons.slice(0, topReasons), why, meta: c.meta }
  }).sort((a, b) => b.score - a.score)
}

export type Feedback = { features: Record<string, number>; outcome: "positive" | "negative" }
export type Calibration = { weights: Record<string, number>; adjustments: { feature: string; from: number; to: number; delta: number }[]; samples: { positive: number; negative: number } }

/** Adjust strategy weights from real feedback: a feature that is systematically
 * higher among accepted recommendations than dismissed ones gains weight, and
 * vice-versa. Bounded per round and clamped — stable, reversible, auditable. */
export function calibrateWeights(weights: Record<string, number>, feedback: Feedback[], opts: { rate?: number; min?: number; max?: number } = {}): Calibration {
  const rate = opts.rate ?? 0.2, min = opts.min ?? 0.05, max = opts.max ?? 3
  const pos = (feedback || []).filter((f) => f.outcome === "positive")
  const neg = (feedback || []).filter((f) => f.outcome === "negative")
  const next: Record<string, number> = { ...weights }
  const adjustments: Calibration["adjustments"] = []

  // Need signal on both sides to know a feature's discriminative direction.
  if (pos.length && neg.length) {
    for (const f of Object.keys(weights)) {
      const posAvg = pos.reduce((s, x) => s + clamp01(x.features?.[f] ?? 0), 0) / pos.length
      const negAvg = neg.reduce((s, x) => s + clamp01(x.features?.[f] ?? 0), 0) / neg.length
      const delta = posAvg - negAvg           // -1..1
      if (Math.abs(delta) < 1e-6) continue
      const from = weights[f]
      const to = Math.max(min, Math.min(max, from * (1 + rate * delta)))
      if (Math.abs(to - from) > 1e-9) { next[f] = to; adjustments.push({ feature: f, from, to, delta }) }
    }
  }
  return { weights: next, adjustments, samples: { positive: pos.length, negative: neg.length } }
}
