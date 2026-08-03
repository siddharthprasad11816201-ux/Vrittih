/* AIOS engine providers — expose the five cognitive engines (§10 reasoning,
 * §11 planning, §19 reflection, §25 evaluation, §18 recommendation) through the
 * execute() gateway so every invocation is authorized, audited (AiRun) and
 * observable. Thin wrappers over the pure engine cores — no duplicated logic. */
import { registerProvider } from "./execute"
import { reason, forwardChain } from "./reason"
import { plan } from "./plan"
import { reflect } from "./reflect"
import { evaluate } from "./evaluate"
import { rank, calibrateWeights } from "./recommend"

registerProvider("reasoning.infer", async (ctx) => {
  const inp = ctx.input || {}
  if (inp.mode === "chain") {
    const r = forwardChain(inp.facts || [], inp.rules || [], inp.maxIterations)
    return { output: r, explanation: `Derived ${r.derived.length} fact(s) over ${r.iterations} iteration(s)`, modelId: "reason-engine-v1" }
  }
  const r = reason(String(inp.question || ""), inp.evidence || [], inp.threshold)
  return { output: r, confidence: r.confidence, explanation: r.explanation, modelId: "reason-engine-v1" }
})

registerProvider("planning.plan", async (ctx) => {
  const inp = ctx.input || {}
  const r = plan(inp.goal || [], inp.initial || [], inp.actions || [], inp.opts || {})
  return { output: r, confidence: r.feasible ? 1 : 0, explanation: r.reason, modelId: "plan-engine-v1" }
})

registerProvider("reflection.reflect", async (ctx) => {
  const r = reflect(ctx.input || {})
  return { output: r, confidence: r.score, explanation: r.summary, modelId: "reflect-engine-v1" }
})

registerProvider("evaluation.evaluate", async (ctx) => {
  const inp = ctx.input || {}
  const r = evaluate(inp.criteria || [], inp.threshold)
  return { output: r, confidence: r.overall, explanation: r.rationale, modelId: "evaluate-engine-v1" }
})

registerProvider("recommendation.rank", async (ctx) => {
  const inp = ctx.input || {}
  if (inp.mode === "calibrate") {
    const r = calibrateWeights(inp.weights || {}, inp.feedback || [], inp.opts || {})
    return { output: r, explanation: `Calibrated ${r.adjustments.length} weight(s) from ${r.samples.positive}+/${r.samples.negative}- feedback`, modelId: "recommend-engine-v1" }
  }
  const ranked = rank(inp.candidates || [], inp.weights || {}, inp.opts || {})
  return { output: { ranked }, confidence: ranked[0]?.score ?? 0, explanation: `Ranked ${ranked.length} candidate(s)`, modelId: "recommend-engine-v1" }
})
