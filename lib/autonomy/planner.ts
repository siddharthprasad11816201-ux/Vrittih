/* Phase 15 — turn a goal into an ordered, explainable plan by REUSING the in-house
 * STRIPS planner (lib/aios/plan). Pure. Each returned step carries its capability +
 * approval metadata so the executor can run it through the gateway. */
import { plan } from "@/lib/aios/plan"
import { ALL_ACTIONS, stepMeta, goalByKey } from "./catalog"

export type PlanStepState = {
  i: number
  name: string
  title: string
  capId: string | null
  requiresApproval: boolean
  rationale: string
  dependsOn: number[]
  status: "pending" | "running" | "done" | "blocked" | "error" | "awaiting_approval" | "approved"
  result?: { ok?: boolean; confidence?: number | null; explanation?: string; output?: any; runId?: string | null; error?: string }
}

export type BuiltPlan = { feasible: boolean; reason: string; steps: PlanStepState[] }

/* Shape a stored AutonomousPlan row for the client (parses the steps JSON). */
export function shapePlan(p: any) {
  let steps: PlanStepState[] = []; try { steps = JSON.parse(p.steps) } catch {}
  return { id: p.id, goalKey: p.goalKey, goal: p.goal, status: p.status, steps, createdAt: p.createdAt }
}

export function planGoal(goalKey: string): BuiltPlan | null {
  const goal = goalByKey(goalKey)
  if (!goal) return null
  const res = plan(goal.goalFacts, goal.initial, ALL_ACTIONS)
  if (!res.feasible) return { feasible: false, reason: res.reason, steps: [] }
  const steps: PlanStepState[] = res.steps.map((s, i) => {
    const m = stepMeta(s.action)
    return { i, name: s.action, title: m.title, capId: m.capId, requiresApproval: m.requiresApproval, rationale: s.rationale, dependsOn: s.dependsOn, status: "pending" }
  })
  return { feasible: true, reason: res.reason, steps }
}
