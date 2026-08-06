/* AI Project Manager — turns per-project insights + resource balance into a prioritised,
 * explainable standup. PURE, testable. In-house, deterministic (NO external LLM).
 *
 * Phase 5. This is the reasoning the AIOS provider (project.manager) narrates: it reads
 * the real portfolio state (insights from lib/project/intelligence + balance from
 * lib/project/resource) and emits the highest-leverage actions, each with a WHY + link.
 */
import type { ProjectInsight } from "./intelligence"
import type { AllocationBalance } from "./resource"

export type Severity = "urgent" | "high" | "medium" | "low"
const SEV: Record<Severity, number> = { urgent: 4, high: 3, medium: 2, low: 1 }
export interface PmSuggestion { id: string; title: string; detail: string; severity: Severity; action: { label: string; href: string } }
export interface Standup { summary: string; atRisk: number; suggestions: PmSuggestion[] }

/* Build the standup. `insights` are per active/planning project; `balance` is the team-wide
 * open-work distribution. */
export function projectStandup(insights: ProjectInsight[], balance: AllocationBalance): Standup {
  const s: PmSuggestion[] = []
  const link = (id?: string) => id ? "/projects" : "/projects"

  for (const ins of insights) {
    const r = ins.risk
    if (r.band === "high") s.push({ id: `risk-${ins.projectId}`, title: `${ins.name || "Project"} is high-risk`, detail: `${r.reasons.slice(0, 2).map(x => x.detail).join("; ")}.`, severity: "urgent", action: { label: "Open project", href: link(ins.projectId) } })
    else if (r.band === "medium") s.push({ id: `risk-${ins.projectId}`, title: `${ins.name || "Project"} needs attention`, detail: `${(r.reasons[0]?.detail) || "Slipping against plan"}.`, severity: "high", action: { label: "Open project", href: link(ins.projectId) } })

    // Overdue milestones on this project.
    const overdue = ins.criticalMilestones.filter(m => m.overdue)
    if (overdue.length) s.push({ id: `ms-${ins.projectId}`, title: `${overdue.length} overdue milestone(s) on ${ins.name || "a project"}`, detail: `${overdue.slice(0, 2).map(m => `"${m.title}"`).join(", ")} past due.`, severity: "high", action: { label: "Open project", href: link(ins.projectId) } })

    // Schedule slip even if not yet high-risk.
    if (r.band !== "high" && ins.scheduleVarianceDays != null && ins.scheduleVarianceDays < -3) s.push({ id: `slip-${ins.projectId}`, title: `${ins.name || "Project"} forecast ~${-ins.scheduleVarianceDays}d late`, detail: `At the current velocity (${ins.velocityPerWeek}/wk) the ${ins.openTasks} open task(s) finish after the due date.`, severity: "medium", action: { label: "Open project", href: link(ins.projectId) } })

    // Stalled: open work, zero velocity.
    if (ins.openTasks > 0 && ins.velocityPerWeek === 0 && r.band === "low") s.push({ id: `stall-${ins.projectId}`, title: `${ins.name || "Project"} has stalled`, detail: `${ins.openTasks} task(s) open but none completed recently.`, severity: "medium", action: { label: "Open project", href: link(ins.projectId) } })
  }

  // Resource balance signals.
  if (balance.overAllocated > 0) s.push({ id: "over-alloc", title: `${balance.overAllocated} teammate(s) over capacity`, detail: `Rebalance work — the busiest person is at ${balance.maxLoadPct}% of capacity.`, severity: "high", action: { label: "View allocation", href: "/projects" } })
  else if (balance.band === "uneven") s.push({ id: "uneven", title: `Workload is uneven`, detail: `${balance.unassignedOpen} open task(s) unassigned; load is concentrated on a few people.`, severity: "medium", action: { label: "View allocation", href: "/projects" } })
  if (balance.unassignedOpen > 0 && balance.band !== "uneven") s.push({ id: "unassigned", title: `${balance.unassignedOpen} unassigned task(s)`, detail: `Assign owners so nothing falls through the cracks.`, severity: "low", action: { label: "View allocation", href: "/projects" } })

  s.sort((a, b) => SEV[b.severity] - SEV[a.severity])
  const atRisk = insights.filter(i => i.risk.band === "high").length
  const urgent = s.filter(x => x.severity === "urgent").length
  const summary = s.length === 0
    ? "All projects are on track — no pressing actions."
    : `${s.length} action${s.length > 1 ? "s" : ""}${urgent ? `, ${urgent} urgent` : ""} across ${insights.length} active project${insights.length !== 1 ? "s" : ""}.`
  return { summary, atRisk, suggestions: s }
}
