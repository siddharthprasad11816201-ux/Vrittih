/* Phase 15 — Autonomous Enterprise AI catalog. Goals are modelled as facts and
 * capabilities as STRIPS actions so the existing in-house planner (lib/aios/plan)
 * produces the ordered, explainable plan. Each domain follows the honest pattern:
 * assess (gather real evidence) → deliberate (reason via the Brain) → decide
 * (human-approved action). Every capId is a real, gateway-executable capability. */
import type { Action } from "@/lib/aios/plan"

export type AutoDomain = { key: string; label: string; capId: string; assessTitle: string }

export const DOMAINS: AutoDomain[] = [
  { key: "workforce", label: "Workforce", capId: "hr.copilot", assessTitle: "Assess workforce (attrition & promotion)" },
  { key: "finance", label: "Finance", capId: "finance.advisor", assessTitle: "Assess financial health" },
  { key: "projects", label: "Projects", capId: "project.manager", assessTitle: "Assess project portfolio" },
]

/* Per-step metadata the planner's Action doesn't carry (capId, approval, title). */
export type StepMeta = { title: string; capId: string | null; requiresApproval: boolean }

const META: Record<string, StepMeta> = {}
const ACTIONS: Action[] = []
for (const d of DOMAINS) {
  ACTIONS.push({ name: `assess:${d.key}`, requires: [], adds: [`ev:${d.key}`], rationale: `Gather real ${d.label.toLowerCase()} evidence via ${d.capId}` })
  META[`assess:${d.key}`] = { title: d.assessTitle, capId: d.capId, requiresApproval: false }

  ACTIONS.push({ name: `reason:${d.key}`, requires: [`ev:${d.key}`], adds: [`reasoned:${d.key}`], rationale: `Deliberate on the ${d.label.toLowerCase()} evidence via the Enterprise Brain` })
  META[`reason:${d.key}`] = { title: `Deliberate: ${d.label}`, capId: "intelligence.deliberate", requiresApproval: false }

  ACTIONS.push({ name: `decide:${d.key}`, requires: [`reasoned:${d.key}`], adds: [`decided:${d.key}`], rationale: `Approve and record the recommended ${d.label.toLowerCase()} action` })
  META[`decide:${d.key}`] = { title: `Approve ${d.label.toLowerCase()} action`, capId: null, requiresApproval: true }
}

export const ALL_ACTIONS = ACTIONS
export const stepMeta = (name: string): StepMeta => META[name] || { title: name, capId: null, requiresApproval: false }

export type Goal = { key: string; title: string; goalFacts: string[]; initial: string[] }
export const GOALS: Goal[] = DOMAINS.map(d => ({
  key: d.key,
  title: `Act on ${d.label.toLowerCase()}`,
  goalFacts: [`decided:${d.key}`],
  initial: [],
}))
export const goalByKey = (k: string) => GOALS.find(g => g.key === k) || null
