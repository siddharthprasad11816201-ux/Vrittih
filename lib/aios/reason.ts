/* AIOS §10 — the Reasoning Engine. In-house, deterministic, explainable
 * inference — NO LLM. Two primitives that compose:
 *   1. reason()        — weighted argumentation: aggregate evidence for/against a
 *                        claim into a conclusion + calibrated confidence + trace.
 *   2. forwardChain()  — rule-based forward chaining: derive new facts from known
 *                        facts and if→then rules, with a derivation trace.
 * Every conclusion is traceable to its evidence/rules (explainability §26).
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §10. */

export type Evidence = { id: string; statement: string; stance: "support" | "oppose"; weight: number; source?: string }
export type ReasonStep = { statement: string; stance: "support" | "oppose"; weight: number; contribution: number; source?: string }
export type Conclusion = "supported" | "refuted" | "uncertain"
export type ReasonResult = {
  question: string
  conclusion: Conclusion
  net: number            // -1..1 (support vs oppose balance)
  confidence: number     // 0..1
  steps: ReasonStep[]    // ordered by absolute contribution, each cited
  explanation: string
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Weighted argumentation over evidence. `threshold` (0..1) is the |net| needed
 * to commit to supported/refuted; below it the verdict is uncertain. */
export function reason(question: string, evidence: Evidence[], threshold = 0.15): ReasonResult {
  const clean = (evidence || []).filter((e) => e && e.weight > 0)
  const support = clean.filter((e) => e.stance === "support").reduce((s, e) => s + e.weight, 0)
  const oppose = clean.filter((e) => e.stance === "oppose").reduce((s, e) => s + e.weight, 0)
  const total = support + oppose
  const net = total === 0 ? 0 : (support - oppose) / total

  const conclusion: Conclusion = net >= threshold ? "supported" : net <= -threshold ? "refuted" : "uncertain"

  // Confidence blends the strength of the balance with how much evidence exists:
  // a lopsided verdict from one weak fact should not be as confident as the same
  // balance backed by many strong facts. Saturates as evidence mass grows.
  const mass = 1 - Math.exp(-total)          // 0..1, →1 as total weight grows
  const confidence = clamp01(Math.abs(net) * (0.5 + 0.5 * mass))

  const steps: ReasonStep[] = clean
    .map((e) => ({ statement: e.statement, stance: e.stance, weight: e.weight, contribution: total === 0 ? 0 : (e.stance === "support" ? e.weight : -e.weight) / total, source: e.source }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))

  const top = steps[0]
  const explanation = total === 0
    ? "No evidence supplied — cannot reason about the claim."
    : `${conclusion === "supported" ? "Supported" : conclusion === "refuted" ? "Refuted" : "Uncertain"} (net ${net.toFixed(2)}, ${clean.length} signal${clean.length === 1 ? "" : "s"})` +
      (top ? `; strongest: ${top.statement}` : "")

  return { question, conclusion, net, confidence, steps, explanation }
}

export type Rule = { id: string; if: string[]; then: string; weight?: number }
export type Derivation = { fact: string; via: string; from: string[] }
export type ChainResult = { facts: string[]; derived: Derivation[]; iterations: number }

/** Forward-chaining inference: repeatedly fire rules whose antecedents are all
 * known until no new facts appear (fixpoint). Deterministic + terminating. */
export function forwardChain(initialFacts: string[], rules: Rule[], maxIterations = 50): ChainResult {
  const known = new Set(initialFacts)
  const derived: Derivation[] = []
  let iterations = 0
  let changed = true
  while (changed && iterations < maxIterations) {
    changed = false
    iterations++
    for (const r of rules) {
      if (known.has(r.then)) continue
      if (r.if.length > 0 && r.if.every((a) => known.has(a))) {
        known.add(r.then)
        derived.push({ fact: r.then, via: r.id, from: [...r.if] })
        changed = true
      }
    }
  }
  return { facts: [...known], derived, iterations }
}
