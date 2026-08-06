/* Project & Collaboration — progress + portfolio health. PURE, testable.
 *
 * Phase 5. Deterministic project progress (milestones + tasks), at-risk detection, and a
 * portfolio roll-up. Reuses the existing Task model for the board. No external services.
 */

export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "DONE", "ARCHIVED"] as const
export const MILESTONE_STATUSES = ["PENDING", "IN_PROGRESS", "DONE"] as const
export const TASK_STATUSES = ["TODO", "DOING", "DONE"] as const

export interface ProgressInput {
  milestonesDone: number; milestonesTotal: number
  tasksDone: number; tasksTotal: number
}
/* Blended progress: milestones weigh 60%, tasks 40% (milestones are the coarse plan). */
export function projectProgress(p: ProgressInput): number {
  const m = p.milestonesTotal > 0 ? p.milestonesDone / p.milestonesTotal : null
  const t = p.tasksTotal > 0 ? p.tasksDone / p.tasksTotal : null
  if (m == null && t == null) return 0
  if (m == null) return Math.round((t as number) * 100)
  if (t == null) return Math.round(m * 100)
  return Math.round((m * 0.6 + t * 0.4) * 100)
}

export interface ProjectLike { status: string; dueAt?: number | string | Date | null; progress: number }
/* At risk = active, past due (or due within 7 days) and under 70% complete. */
export function isAtRisk(p: ProjectLike, now = Date.now()): boolean {
  if (p.status !== "ACTIVE" && p.status !== "PLANNING") return false
  if (p.progress >= 70) return false
  if (!p.dueAt) return false
  const due = +new Date(p.dueAt as any)
  if (!Number.isFinite(due)) return false
  return due - now <= 7 * 864e5
}

export interface PortfolioHealth {
  total: number; active: number; done: number; onHold: number
  atRisk: number; avgProgress: number
  band: "healthy" | "watch" | "at-risk"
}
export function portfolioHealth(projects: (ProjectLike & { progress: number })[], now = Date.now()): PortfolioHealth {
  const total = projects.length
  const active = projects.filter(p => p.status === "ACTIVE").length
  const done = projects.filter(p => p.status === "DONE").length
  const onHold = projects.filter(p => p.status === "ON_HOLD").length
  const atRisk = projects.filter(p => isAtRisk(p, now)).length
  const inFlight = projects.filter(p => p.status === "ACTIVE" || p.status === "PLANNING")
  const avgProgress = inFlight.length ? Math.round(inFlight.reduce((a, p) => a + p.progress, 0) / inFlight.length) : 0
  const riskRate = total ? atRisk / total : 0
  const band: PortfolioHealth["band"] = riskRate >= 0.4 ? "at-risk" : riskRate >= 0.15 ? "watch" : "healthy"
  return { total, active, done, onHold, atRisk, avgProgress, band }
}

/* Group tasks into kanban columns (stable order). */
export function kanban<T extends { status: string }>(tasks: T[]): Record<string, T[]> {
  const cols: Record<string, T[]> = { TODO: [], DOING: [], DONE: [] }
  for (const t of tasks) (cols[t.status] || (cols[t.status] = [])).push(t)
  return cols
}
