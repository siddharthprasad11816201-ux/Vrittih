/* Phase 14 — compute live twin snapshots from REAL data. The twin is never stored;
 * it is recomputed from the current rows each time. */
import { prisma } from "@/lib/prisma"
import { forecastCompletion } from "@/lib/project/intelligence"
import type { OrgSnapshot, ProjectSnapshot } from "./simulate"

const YEAR = 365 * 86400000
const WEEK = 7 * 86400000

/* Parse the first monetary figure out of a salary string ("CHF 90'000" → 90000). */
export function parseSalary(s: string | null | undefined): number {
  if (!s) return 0
  const m = String(s).match(/(\d[\d'’,. ]*)/)
  if (!m) return 0
  return parseInt(m[1].replace(/[^\d]/g, ""), 10) || 0
}

export async function computeOrgTwin(employerId: string): Promise<OrgSnapshot> {
  const emps = await prisma.employee.findMany({
    where: { employerId },
    select: { status: true, department: true, joinedAt: true, exitedAt: true, salary: true },
    take: 20000,
  }).catch(() => [] as any[])
  const active = emps.filter(e => e.status !== "EXITED")
  const headcount = active.length

  const deptMap = new Map<string, number>()
  for (const e of active) { const d = e.department || "Unassigned"; deptMap.set(d, (deptMap.get(d) || 0) + 1) }
  const byDepartment = [...deptMap.entries()].map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count)

  const now = Date.now()
  const exits12 = emps.filter(e => e.exitedAt && new Date(e.exitedAt).getTime() >= now - YEAR).length
  const avgHead = Math.max(1, headcount + exits12 / 2)
  const annualAttritionPct = +((exits12 / avgHead) * 100).toFixed(1)
  const hires12 = emps.filter(e => new Date(e.joinedAt).getTime() >= now - YEAR).length
  const monthlyHiresAvg = +(hires12 / 12).toFixed(1)

  const salaries = active.map(e => parseSalary(e.salary)).filter(n => n > 0)
  const avgAnnualCostCHF = salaries.length ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length) : 0

  return { headcount, byDepartment, annualAttritionPct, monthlyHiresAvg, avgAnnualCostCHF }
}

export type ProjectTwin = { project: { id: string; name: string; status: string }; snapshot: ProjectSnapshot }

/* Returns null if the project doesn't exist or the caller isn't the owner/employer. */
export async function computeProjectTwin(projectId: string, userId: string): Promise<ProjectTwin | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, status: true, ownerId: true, employerId: true } }).catch(() => null)
  if (!project) return null
  if (project.ownerId !== userId && project.employerId !== userId) return null

  const tasks = await prisma.task.findMany({ where: { projectId }, select: { status: true, completedAt: true, assigneeId: true }, take: 20000 }).catch(() => [] as any[])
  const openTasks = tasks.filter(t => t.status !== "DONE").length
  const now = Date.now()
  const doneRecent = tasks.filter(t => t.status === "DONE" && t.completedAt && new Date(t.completedAt).getTime() >= now - 8 * WEEK).length
  const perWeek = +(doneRecent / 8).toFixed(2)
  const teamSize = Math.max(1, new Set(tasks.map(t => t.assigneeId).filter(Boolean)).size)
  const f = forecastCompletion(openTasks, perWeek)

  return { project: { id: project.id, name: project.name, status: project.status }, snapshot: { openTasks, perWeek, etaWeeks: f.weeksRemaining, teamSize } }
}
