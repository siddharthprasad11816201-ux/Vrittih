/* EAIL — the Enterprise Intelligence Layer's unified deliberation pipeline.
 *
 * This is the single reasoning core every AI capability routes through (per the EAIL spec):
 *
 *   Context -> Knowledge -> Memory -> Competency -> Evidence -> Reasoning -> Decision
 *   -> Recommendation -> Explainability -> Reflection -> Confidence
 *
 * It is NOT an LLM and NOT a heuristic-with-a-prompt. It COMPOSES the platform's existing
 * in-house cognitive engines — argumentation (reason), rubric evaluation (evaluate),
 * ranking (recommend), and self-critique (reflect) — into one evidence-based, explainable,
 * confidence-scored, self-reflective decision. Retrieval (context/knowledge/memory/
 * competency) is domain-specific and performed by each caller from REAL data, then handed
 * in as a Brief; deliberate() performs the universal reasoning over it.
 *
 * Every output answers the EAIL explainability questions: Why? On what evidence? How
 * confident? What alternatives? What risks? — with honest confidence (never fabricated).
 */
import { reason, type Evidence, type ReasonResult } from "@/lib/aios/reason"
import { evaluate, type Criterion, type Evaluation } from "@/lib/aios/evaluate"
import { rank, type Candidate, type Ranked } from "@/lib/aios/recommend"
import { reflect, type Reflection } from "@/lib/aios/reflect"

export type { Evidence, Criterion, Candidate }

export interface Brief {
  role: string                          // the expert role being emulated, e.g. "hiring manager"
  question: string                      // the decision/claim under deliberation
  context?: string[]                    // retrieved context facts considered
  memory?: string[]                     // relevant prior memory items
  competency?: { key: string; proficiency: number; required?: number }[]  // competency evidence
  evidence?: Evidence[]                 // support/oppose signals gathered from real data
  criteria?: Criterion[]                // scored criteria (0..1) for rubric evaluation
  options?: Candidate[]                 // candidate options to rank (features 0..1)
  weights?: Record<string, number>      // feature weights for ranking
  reasoningThreshold?: number
  evalThreshold?: number
}

export type Verdict = "supported" | "refuted" | "uncertain" | "insufficient-evidence"
export interface EvidenceView { statement: string; weight: number; source?: string; contribution: number }
export interface Deliberation {
  role: string
  question: string
  stages: string[]
  decision: { verdict: Verdict; summary: string; chosen: string | null }
  confidence: number                    // 0..1 — honest, blended, never fabricated
  reasoning: ReasonResult
  evaluation: Evaluation | null
  recommendation: Ranked | null
  alternatives: Ranked[]
  evidence: { supporting: EvidenceView[]; opposing: EvidenceView[]; count: number }
  risks: string[]
  reflection: Reflection
  explanation: string
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const pctS = (n: number) => `${Math.round(n * 100)}%`

/* Competency gaps become oppose-evidence automatically (an expert weighs shortfalls). */
function competencyEvidence(comp: NonNullable<Brief["competency"]>): Evidence[] {
  const out: Evidence[] = []
  for (const c of comp) {
    const req = c.required ?? 0.6
    if (c.proficiency >= req) out.push({ id: `comp:${c.key}`, statement: `Meets ${c.key} (${pctS(c.proficiency)} ≥ ${pctS(req)})`, stance: "support", weight: Math.min(1, 0.4 + (c.proficiency - req)), source: "competency-graph" })
    else out.push({ id: `comp:${c.key}`, statement: `Below bar on ${c.key} (${pctS(c.proficiency)} < ${pctS(req)})`, stance: "oppose", weight: Math.min(1, 0.4 + (req - c.proficiency)), source: "competency-graph" })
  }
  return out
}

/* Run the full deliberation pipeline over a Brief. Deterministic and pure. */
export function deliberate(brief: Brief): Deliberation {
  const stages: string[] = []
  const role = brief.role || "analyst"

  // 1-4) Context / Knowledge / Memory / Competency retrieval (supplied by the caller).
  if (brief.context?.length) stages.push("context")
  if (brief.memory?.length) stages.push("memory")
  const compEv = brief.competency?.length ? competencyEvidence(brief.competency) : []
  if (compEv.length) stages.push("competency")

  // 5) Evidence analysis.
  const allEvidence: Evidence[] = [...(brief.evidence || []), ...compEv]
  stages.push("evidence")
  const supporting = allEvidence.filter(e => e.stance === "support")
  const opposing = allEvidence.filter(e => e.stance === "oppose")

  // 6) Reasoning (weighted argumentation).
  stages.push("reasoning")
  const reasoning = reason(brief.question, allEvidence, brief.reasoningThreshold ?? 0.15)
  const stepBy = new Map<string, number>(reasoning.steps.map(s => [s.statement, s.contribution] as [string, number]))
  const view = (e: Evidence): EvidenceView => ({ statement: e.statement, weight: e.weight, source: e.source, contribution: +(stepBy.get(e.statement) ?? 0).toFixed(3) })

  // 7) Evaluation (rubric), optional.
  let evaluation: Evaluation | null = null
  if (brief.criteria?.length) { stages.push("evaluation"); evaluation = evaluate(brief.criteria, brief.evalThreshold ?? 0.6) }

  // 8) Recommendation (ranking), optional.
  let recommendation: Ranked | null = null
  let alternatives: Ranked[] = []
  if (brief.options?.length) {
    stages.push("recommendation")
    const ranked = rank(brief.options, brief.weights || {}, { topReasons: 3 })
    recommendation = ranked[0] || null
    alternatives = ranked.slice(1, 4)
  }

  // 9) Decision.
  stages.push("decision")
  const hasEvidence = allEvidence.some(e => e.weight > 0)
  const verdict: Verdict = !hasEvidence ? "insufficient-evidence" : reasoning.conclusion
  const chosen = recommendation?.id ?? null

  // 10) Risks — counter-evidence, weak criteria, close calls, thin evidence.
  const risks: string[] = []
  for (const e of opposing.slice(0, 4)) risks.push(`Counter-evidence: ${e.statement}`)
  if (evaluation) for (const c of evaluation.criteria.filter(c => c.band === "weak")) risks.push(`Weak on ${c.label}`)
  if (recommendation && alternatives[0] && recommendation.score > 0 && (recommendation.score - alternatives[0].score) / recommendation.score < 0.1)
    risks.push(`Close call — "${alternatives[0].id}" is a comparable alternative`)
  if (!hasEvidence) risks.push("No evidence gathered — decision is provisional")

  // 11) Confidence — honest blend of argument strength, evidence mass, rubric, and margin.
  stages.push("confidence")
  let confidence = reasoning.confidence
  if (evaluation) confidence = 0.6 * confidence + 0.4 * evaluation.overall
  if (recommendation) {
    const margin = alternatives[0] && recommendation.score > 0 ? clamp01((recommendation.score - alternatives[0].score) / recommendation.score) : 1
    confidence = 0.8 * confidence + 0.2 * (0.5 + 0.5 * margin)   // a decisive winner adds confidence
  }
  if (!hasEvidence) confidence = Math.min(confidence, 0.15)
  confidence = +clamp01(confidence).toFixed(3)

  // 12) Reflection — self-critique against what a complete deliberation should contain.
  const expected = ["evidence-considered", ...(brief.criteria?.length ? ["criteria-evaluated"] : []), ...(brief.options?.length ? ["options-ranked"] : [])]
  const actual = [
    ...(hasEvidence ? ["evidence-considered"] : []),
    ...(evaluation ? ["criteria-evaluated"] : []),
    ...(recommendation ? ["options-ranked"] : []),
  ]
  const reflection = reflect({ goal: brief.question, status: "ok", confidence, expected, actual, errors: [] })
  stages.push("reflection")

  // Explainability narrative — the EAIL questions, answered.
  const verdictLabel = verdict === "supported" ? "Yes" : verdict === "refuted" ? "No" : verdict === "insufficient-evidence" ? "Not enough evidence" : "Unclear"
  const top = reasoning.steps[0]
  const decisionSummary = recommendation
    ? `Recommend "${recommendation.id}" — ${recommendation.why}`
    : `${verdictLabel} — ${reasoning.explanation}`
  const explanation = [
    `As a ${role}: ${decisionSummary}`,
    `Why: ${top ? top.statement : "no decisive signal"}${supporting.length ? ` (+${supporting.length} supporting${opposing.length ? `, ${opposing.length} opposing` : ""})` : ""}.`,
    `Confidence: ${pctS(confidence)}${confidence < 0.4 ? " — low; treat as provisional" : ""}.`,
    alternatives.length ? `Alternatives: ${alternatives.map(a => a.id).join(", ")}.` : null,
    risks.length ? `Risks: ${risks.slice(0, 3).join("; ")}.` : "Risks: none material.",
    reflection.met ? null : `Gap: ${reflection.issues[0] || reflection.improvements[0]}.`,
  ].filter(Boolean).join(" ")

  return {
    role, question: brief.question, stages,
    decision: { verdict, summary: decisionSummary, chosen },
    confidence, reasoning, evaluation, recommendation, alternatives,
    evidence: { supporting: supporting.map(view), opposing: opposing.map(view), count: allEvidence.length },
    risks, reflection, explanation,
  }
}
