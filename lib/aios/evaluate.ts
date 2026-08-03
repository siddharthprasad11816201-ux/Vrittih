/* AIOS §25 — the Evaluation Engine. In-house, deterministic rubric scorer, NO
 * LLM. Scores any subject (an output, a decision, a candidate, a model run)
 * against weighted criteria, producing per-criterion scores, a normalized
 * weighted overall, a pass/fail against a threshold, and a rationale naming the
 * strongest and weakest criteria. Generalizes lib/aios/eval.ts (runSelfEval) into
 * a reusable primitive. See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §25. */

export type Criterion = { key: string; label?: string; weight: number; score: number }  // score in 0..1
export type CriterionResult = Criterion & { label: string; weightedContribution: number; band: "strong" | "adequate" | "weak" }
export type Evaluation = {
  overall: number          // 0..1 weighted
  band: "strong" | "adequate" | "weak"
  passed: boolean
  criteria: CriterionResult[]
  strongest: string | null
  weakest: string | null
  rationale: string
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const bandOf = (n: number): "strong" | "adequate" | "weak" => (n >= 0.7 ? "strong" : n >= 0.45 ? "adequate" : "weak")

export function evaluate(criteria: Criterion[], threshold = 0.6): Evaluation {
  const clean = (criteria || []).filter((c) => c && c.weight > 0)
  const totalWeight = clean.reduce((s, c) => s + c.weight, 0)
  if (totalWeight === 0) {
    return { overall: 0, band: "weak", passed: false, criteria: [], strongest: null, weakest: null, rationale: "No weighted criteria supplied — nothing to evaluate." }
  }

  const results: CriterionResult[] = clean.map((c) => {
    const score = clamp01(c.score)
    const share = c.weight / totalWeight
    return { ...c, score, label: c.label || c.key, weightedContribution: score * share, band: bandOf(score) }
  })

  const overall = clamp01(results.reduce((s, c) => s + c.weightedContribution, 0))
  const sortedByScore = [...results].sort((a, b) => b.score - a.score)
  const strongest = sortedByScore[0]?.label ?? null
  const weakest = sortedByScore[sortedByScore.length - 1]?.label ?? null
  const passed = overall >= threshold

  const weak = results.filter((c) => c.band === "weak").map((c) => c.label)
  const rationale =
    `Overall ${(overall * 100).toFixed(0)}% (${bandOf(overall)}), ${passed ? "passes" : "below"} threshold ${(threshold * 100).toFixed(0)}%. ` +
    (strongest ? `Strongest: ${strongest}. ` : "") +
    (weak.length ? `Needs work: ${weak.join(", ")}.` : "No weak criteria.")

  return { overall, band: bandOf(overall), passed, criteria: results, strongest, weakest, rationale }
}
