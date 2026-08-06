/* EAIL — the deliberation core as an AIOS capability. Every AI product routes its
 * decisions through execute("intelligence.deliberate", { input: { brief } }) so the
 * reasoning is authorized, audited (AiRun) and observable — no module bypasses it. The
 * caller performs domain retrieval (context/knowledge/memory/competency/evidence) and
 * hands in a Brief; this runs the universal evidence-based, explainable, reflective
 * reasoning. In-house, no external LLM. */
import { registerProvider } from "./execute"
import { deliberate, type Brief } from "@/lib/intelligence/deliberate"

registerProvider("intelligence.deliberate", async (ctx) => {
  const raw = (ctx.input?.brief ?? ctx.input ?? {}) as Partial<Brief>
  const brief: Brief = {
    role: String(raw.role || "analyst").slice(0, 80),
    question: String(raw.question || "").slice(0, 500),
    context: Array.isArray(raw.context) ? raw.context.slice(0, 50) : undefined,
    memory: Array.isArray(raw.memory) ? raw.memory.slice(0, 50) : undefined,
    competency: Array.isArray(raw.competency) ? raw.competency.slice(0, 100) : undefined,
    evidence: Array.isArray(raw.evidence) ? raw.evidence.slice(0, 200) : undefined,
    criteria: Array.isArray(raw.criteria) ? raw.criteria.slice(0, 50) : undefined,
    options: Array.isArray(raw.options) ? raw.options.slice(0, 200) : undefined,
    weights: raw.weights && typeof raw.weights === "object" ? raw.weights : undefined,
    reasoningThreshold: typeof raw.reasoningThreshold === "number" ? raw.reasoningThreshold : undefined,
    evalThreshold: typeof raw.evalThreshold === "number" ? raw.evalThreshold : undefined,
  }
  const d = deliberate(brief)
  return { output: d, confidence: d.confidence, explanation: d.explanation, modelId: "enterprise-brain-v1" }
})
