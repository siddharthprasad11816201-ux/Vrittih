/* AIOS §19 — the Reflection Engine. In-house, deterministic self-critique of an
 * execution/outcome, NO LLM. Compares what was intended against what happened,
 * surfaces concrete issues, and derives actionable improvements — the input to
 * the learning pipeline (a reflection can become a MemoryEntry or, for sensitive
 * changes, a human-gated ChangeProposal per DDR-007).
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §19. */

export type ReflectInput = {
  goal?: string
  status?: string          // "ok" | "error" | "denied" | ...
  confidence?: number      // 0..1
  expected?: string[]      // predicates/items that should have been produced
  actual?: string[]        // predicates/items actually produced
  errors?: string[]
}
export type Reflection = {
  met: boolean
  score: number            // 0..1 overall quality
  recall: number | null    // fraction of expected that was produced (null if no expected set)
  missed: string[]
  extra: string[]
  issues: string[]
  improvements: string[]
  summary: string
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export function reflect(input: ReflectInput): Reflection {
  const status = input.status || "ok"
  const conf = typeof input.confidence === "number" ? input.confidence : null
  const expected = input.expected || null
  const actual = new Set(input.actual || [])
  const errors = input.errors || []

  let missed: string[] = [], extra: string[] = [], recall: number | null = null
  if (expected) {
    missed = expected.filter((e) => !actual.has(e))
    extra = [...actual].filter((a) => !expected.includes(a))
    recall = expected.length === 0 ? 1 : (expected.length - missed.length) / expected.length
  }

  const issues: string[] = []
  if (status === "error") issues.push("Execution ended in an error state")
  else if (status === "denied") issues.push("Execution was denied (authorization/safety)")
  for (const e of errors) issues.push(`Error: ${e}`)
  for (const m of missed) issues.push(`Expected outcome not produced: ${m}`)
  if (conf !== null && conf < 0.4) issues.push(`Low confidence (${conf.toFixed(2)})`)
  if (extra.length > 3) issues.push(`Produced ${extra.length} unexpected outputs — possible over-generation`)

  const improvements: string[] = []
  if (status === "error" || errors.length) improvements.push("Add input validation / fallback capability for the failure mode")
  if (missed.length) improvements.push("Retrieve additional evidence or decompose the goal into sub-goals to cover gaps")
  if (conf !== null && conf < 0.4) improvements.push("Gather more corroborating signals before committing to a conclusion")
  if (!issues.length) improvements.push("Outcome met expectations — capture as a positive exemplar for future calibration")

  // Score: goal attainment dominates; errors and low confidence penalize.
  let score = 1
  if (status === "error") score -= 0.6
  else if (status === "denied") score -= 0.4
  score -= Math.min(0.4, errors.length * 0.2)
  if (recall !== null) score -= (1 - recall) * 0.4
  if (conf !== null) score -= (1 - conf) * 0.15
  score = clamp01(score)

  const met = status === "ok" && (recall === null ? true : recall >= 0.999) && errors.length === 0
  const summary = met
    ? `Goal met${conf !== null ? ` (confidence ${conf.toFixed(2)})` : ""} — ${improvements[0]}`
    : `Goal not fully met: ${issues[0] || "unspecified issue"}. Next: ${improvements[0]}`

  return { met, score, recall, missed, extra, issues, improvements, summary }
}
