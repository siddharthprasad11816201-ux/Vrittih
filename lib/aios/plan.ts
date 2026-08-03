/* AIOS §11 — the Planning Engine. In-house, deterministic goal planner over
 * actions with preconditions and effects (STRIPS-style), NO LLM. Finds the
 * shortest action sequence from an initial state to a goal via breadth-first
 * search over the state space (so if a plan exists within the bound, it is found
 * and it is minimal), then annotates each step with its rationale and the prior
 * steps it depends on. Fail-closed: returns feasible:false with a reason.
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §11. */

export type Action = { name: string; requires?: string[]; adds?: string[]; removes?: string[]; cost?: number; rationale?: string }
export type PlanStep = { action: string; rationale: string; requires: string[]; produces: string[]; dependsOn: number[]; cost: number }
export type PlanResult = {
  goal: string[]
  feasible: boolean
  steps: PlanStep[]
  totalCost: number
  reason: string
  nodesExplored: number
}

const keyOf = (s: Set<string>) => [...s].sort().join("|")
const satisfied = (goal: string[], s: Set<string>) => goal.every((g) => s.has(g))
const applicable = (a: Action, s: Set<string>) => (a.requires || []).every((r) => s.has(r))
function apply(a: Action, s: Set<string>): Set<string> {
  const next = new Set(s)
  for (const r of a.removes || []) next.delete(r)
  for (const p of a.adds || []) next.add(p)
  return next
}

export function plan(goal: string[], initial: string[], actions: Action[], opts: { maxDepth?: number; maxNodes?: number } = {}): PlanResult {
  const maxDepth = opts.maxDepth ?? 12
  const maxNodes = opts.maxNodes ?? 5000
  const start = new Set(initial)
  if (satisfied(goal, start)) return { goal, feasible: true, steps: [], totalCost: 0, reason: "Goal already satisfied", nodesExplored: 0 }

  // BFS over states → shortest action sequence. Track the path (action list) per node.
  const queue: { state: Set<string>; path: Action[] }[] = [{ state: start, path: [] }]
  const seen = new Set<string>([keyOf(start)])
  let nodesExplored = 0

  while (queue.length && nodesExplored < maxNodes) {
    const cur = queue.shift()!
    nodesExplored++
    if (cur.path.length >= maxDepth) continue
    for (const a of actions) {
      if (!applicable(a, cur.state)) continue
      const next = apply(a, cur.state)
      const k = keyOf(next)
      if (seen.has(k)) continue           // avoid revisiting equal states (also blocks no-op loops)
      const path = [...cur.path, a]
      if (satisfied(goal, next)) return buildResult(goal, path, nodesExplored)
      seen.add(k)
      queue.push({ state: next, path })
    }
  }
  const why = nodesExplored >= maxNodes ? "Search bound reached before a plan was found" : "No action sequence reaches the goal from the initial state"
  return { goal, feasible: false, steps: [], totalCost: 0, reason: why, nodesExplored }
}

function buildResult(goal: string[], path: Action[], nodesExplored: number): PlanResult {
  // Annotate: a step depends on the latest earlier step that produced each fact
  // it requires (a real dependency edge, not just linear order).
  const producedAt = new Map<string, number>()   // fact -> step index that most recently added it
  const steps: PlanStep[] = []
  let totalCost = 0
  path.forEach((a, i) => {
    const requires = a.requires || []
    const dependsOn = Array.from(new Set(requires.map((r) => producedAt.get(r)).filter((x): x is number => x !== undefined)))
    const cost = a.cost ?? 1
    totalCost += cost
    steps.push({ action: a.name, rationale: a.rationale || `Enables ${(a.adds || []).join(", ") || "the goal"}`, requires, produces: a.adds || [], dependsOn, cost })
    for (const p of a.adds || []) producedAt.set(p, i)
  })
  return { goal, feasible: true, steps, totalCost, reason: `Plan of ${steps.length} step(s) reaches the goal`, nodesExplored }
}
