/* Project Intelligence — velocity, forecast, schedule variance, risk. PURE, testable.
 *
 * Phase 5. In-house, deterministic project analytics (NO external LLM). Turns a project's
 * real tasks + milestones into velocity, a forecasted completion date, schedule variance
 * against the due date, and an explainable risk score. Feeds the AI Project Manager
 * (lib/aios ops-providers) which narrates risks + recommends next actions.
 */

const DAY = 864e5
const WEEK = 7 * DAY
const ts = (d: any): number | null => { if (d == null) return null; const n = +new Date(d); return Number.isFinite(n) ? n : null }

export interface TaskLite {
  id: string; status: string; priority?: string; assigneeId?: string | null
  createdAt?: any; updatedAt?: any; completedAt?: any; dueAt?: any
}
export interface MilestoneLite { id: string; title: string; status: string; dueAt?: any }
export interface ProjectLite { id?: string; name?: string; status: string; startAt?: any; dueAt?: any }

/* Completed tasks per week over a trailing window (default 4 weeks). */
export function velocity(tasks: TaskLite[], now = Date.now(), weeks = 4): { perWeek: number; completedInWindow: number; weeks: number } {
  const from = now - weeks * WEEK
  let n = 0
  for (const t of tasks) { const c = ts(t.completedAt); if (t.status === "DONE" && c != null && c >= from && c <= now) n++ }
  return { perWeek: +(n / weeks).toFixed(2), completedInWindow: n, weeks }
}

/* Forecast a completion date from open-task count and weekly velocity.
 * Confidence falls when velocity is near zero or the backlog is large relative to it. */
export function forecastCompletion(openCount: number, perWeek: number, now = Date.now()): { openCount: number; weeksRemaining: number | null; etaAt: number | null; confidence: number } {
  const open = Math.max(0, Math.round(openCount))
  if (open === 0) return { openCount: 0, weeksRemaining: 0, etaAt: now, confidence: 0.9 }
  if (perWeek <= 0) return { openCount: open, weeksRemaining: null, etaAt: null, confidence: 0.15 } // stalled — cannot forecast
  const weeksRemaining = +(open / perWeek).toFixed(1)
  const etaAt = now + weeksRemaining * WEEK
  // More weeks out = less certain; a steady velocity over a small backlog is most trustworthy.
  const confidence = Math.max(0.2, Math.min(0.85, 0.85 - Math.min(0.5, weeksRemaining / 40)))
  return { openCount: open, weeksRemaining, etaAt, confidence: +confidence.toFixed(2) }
}

/* Schedule variance in DAYS: positive = forecast ahead of due; negative = behind. */
export function scheduleVariance(etaAt: number | null, dueAt: any): number | null {
  const due = ts(dueAt)
  if (etaAt == null || due == null) return null
  return Math.round((due - etaAt) / DAY)
}

/* In-progress (DOING) tasks untouched for > staleDays (default 7). */
export function staleTasks(tasks: TaskLite[], now = Date.now(), staleDays = 7): TaskLite[] {
  return tasks.filter(t => { if (t.status !== "DOING") return false; const u = ts(t.updatedAt) ?? ts(t.createdAt); return u != null && now - u > staleDays * DAY })
}

/* Milestones that are overdue, or due within 7 days and not yet done. */
export function criticalMilestones(milestones: MilestoneLite[], now = Date.now()): Array<MilestoneLite & { overdue: boolean; daysToDue: number | null }> {
  const out: Array<MilestoneLite & { overdue: boolean; daysToDue: number | null }> = []
  for (const m of milestones) {
    if (m.status === "DONE") continue
    const due = ts(m.dueAt); if (due == null) continue
    const days = Math.round((due - now) / DAY)
    if (days <= 7) out.push({ ...m, overdue: days < 0, daysToDue: days })
  }
  return out.sort((a, b) => (a.daysToDue ?? 0) - (b.daysToDue ?? 0))
}

export interface RiskReason { factor: string; detail: string; weight: number }
export interface RiskAssessment { score: number; band: "low" | "medium" | "high"; reasons: RiskReason[] }

/* Explainable 0–100 risk score. Higher = more at risk. Every contributing factor is
 * returned with the points it added, so the AI PM can say WHY. */
export function riskScore(project: ProjectLite, tasks: TaskLite[], milestones: MilestoneLite[], now = Date.now()): RiskAssessment {
  const reasons: RiskReason[] = []
  if (project.status === "DONE" || project.status === "ARCHIVED") return { score: 0, band: "low", reasons: [] }

  const open = tasks.filter(t => t.status !== "DONE").length
  const vel = velocity(tasks, now)
  const fc = forecastCompletion(open, vel.perWeek, now)
  const variance = scheduleVariance(fc.etaAt, project.dueAt)

  // 1) Schedule: forecast finishes after the due date.
  if (variance != null && variance < 0) { const w = Math.min(35, 8 + Math.round(-variance / 3)); reasons.push({ factor: "schedule", detail: `Forecast to finish ~${-variance}d after the due date`, weight: w }) }
  // 2) Stalled: work remains but nothing completed recently.
  if (open > 0 && vel.perWeek === 0) { reasons.push({ factor: "stalled", detail: `${open} task(s) open but none completed in the last ${vel.weeks} weeks`, weight: 20 }) }
  // 3) Time burned vs progress: past due, or well past the halfway point with low progress.
  const start = ts(project.startAt), due = ts(project.dueAt)
  const doneCount = tasks.filter(t => t.status === "DONE").length
  const progress = tasks.length ? doneCount / tasks.length : 0
  if (due != null && now > due && progress < 1) { reasons.push({ factor: "overdue", detail: `Past the due date at ${Math.round(progress * 100)}% of tasks done`, weight: 30 }) }
  else if (start != null && due != null && due > start) {
    const elapsed = (now - start) / (due - start)
    if (elapsed > 0.5 && progress < elapsed - 0.15) reasons.push({ factor: "behind-pace", detail: `${Math.round(elapsed * 100)}% of the timeline elapsed but only ${Math.round(progress * 100)}% of tasks done`, weight: Math.min(25, Math.round((elapsed - progress) * 60)) })
  }
  // 4) Overdue milestones.
  const crit = criticalMilestones(milestones, now)
  const overdueMs = crit.filter(c => c.overdue).length
  if (overdueMs > 0) reasons.push({ factor: "milestones", detail: `${overdueMs} milestone(s) overdue`, weight: Math.min(25, overdueMs * 12) })
  // 5) Stale in-progress work.
  const stale = staleTasks(tasks, now).length
  if (stale > 0) reasons.push({ factor: "stale-wip", detail: `${stale} in-progress task(s) untouched for over a week`, weight: Math.min(15, stale * 5) })

  const score = Math.min(100, reasons.reduce((a, r) => a + r.weight, 0))
  const band: RiskAssessment["band"] = score >= 60 ? "high" : score >= 30 ? "medium" : "low"
  reasons.sort((a, b) => b.weight - a.weight)
  return { score, band, reasons }
}

export interface ProjectInsight {
  projectId?: string; name?: string
  progress: number
  velocityPerWeek: number
  openTasks: number
  forecast: ReturnType<typeof forecastCompletion>
  scheduleVarianceDays: number | null
  risk: RiskAssessment
  criticalMilestones: Array<MilestoneLite & { overdue: boolean; daysToDue: number | null }>
}

/* One-shot per-project insight the AI Project Manager narrates. */
export function projectInsight(project: ProjectLite, tasks: TaskLite[], milestones: MilestoneLite[], now = Date.now()): ProjectInsight {
  const open = tasks.filter(t => t.status !== "DONE").length
  const done = tasks.filter(t => t.status === "DONE").length
  const vel = velocity(tasks, now)
  const fc = forecastCompletion(open, vel.perWeek, now)
  return {
    projectId: project.id, name: project.name,
    progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    velocityPerWeek: vel.perWeek, openTasks: open, forecast: fc,
    scheduleVarianceDays: scheduleVariance(fc.etaAt, project.dueAt),
    risk: riskScore(project, tasks, milestones, now),
    criticalMilestones: criticalMilestones(milestones, now),
  }
}
