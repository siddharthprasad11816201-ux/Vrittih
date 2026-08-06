import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { projectProgress, portfolioHealth, isAtRisk, PROJECT_STATUSES, MILESTONE_STATUSES, TASK_STATUSES } from "@/lib/project/health"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const projects = await prisma.project.findMany({ where: { ownerId: p.userId }, include: { milestones: { select: { status: true } } }, orderBy: { updatedAt: "desc" }, take: 200 })
  const ids = projects.map(pr => pr.id)
  const taskCounts = ids.length ? await prisma.task.groupBy({ by: ["projectId", "status"], where: { projectId: { in: ids } }, _count: { _all: true } }).catch(() => [] as any[]) : []
  const tByProject = new Map<string, { done: number; total: number }>()
  for (const g of taskCounts as any[]) { const e = tByProject.get(g.projectId) || { done: 0, total: 0 }; e.total += g._count._all; if (g.status === "DONE") e.done += g._count._all; tByProject.set(g.projectId, e) }
  const shaped = projects.map(pr => {
    const mDone = pr.milestones.filter(m => m.status === "DONE").length
    const tc = tByProject.get(pr.id) || { done: 0, total: 0 }
    const progress = projectProgress({ milestonesDone: mDone, milestonesTotal: pr.milestones.length, tasksDone: tc.done, tasksTotal: tc.total })
    return { id: pr.id, name: pr.name, description: pr.description, status: pr.status, dueAt: pr.dueAt, progress, milestones: pr.milestones.length, tasks: tc.total, atRisk: isAtRisk({ status: pr.status, dueAt: pr.dueAt, progress }) }
  })
  return NextResponse.json({ projects: shaped, portfolio: portfolioHealth(shaped), statuses: PROJECT_STATUSES })
}

export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const action = String(b.action || "create-project")

  if (action === "create-project") {
    const name = String(b.name || "").trim()
    if (!name) return NextResponse.json({ error: "Project name required." }, { status: 400 })
    const pr = await prisma.project.create({ data: { ownerId: p.userId, name: name.slice(0, 200), description: b.description ? String(b.description).slice(0, 4000) : null, status: "ACTIVE", dueAt: b.dueAt ? new Date(b.dueAt) : null } })
    return NextResponse.json({ success: true, id: pr.id }, { status: 201 })
  }

  // All remaining actions operate on a project the caller owns.
  const project = b.projectId ? await prisma.project.findUnique({ where: { id: String(b.projectId) }, select: { ownerId: true } }) : null
  if (b.projectId && (!project || project.ownerId !== p.userId)) return NextResponse.json({ error: "Not your project." }, { status: 403 })

  if (action === "add-milestone") {
    const title = String(b.title || "").trim(); if (!title) return NextResponse.json({ error: "Milestone title required." }, { status: 400 })
    const max = await prisma.milestone.aggregate({ where: { projectId: String(b.projectId) }, _max: { order: true } })
    await prisma.milestone.create({ data: { projectId: String(b.projectId), title: title.slice(0, 200), status: "PENDING", order: (max._max.order || 0) + 1, dueAt: b.dueAt ? new Date(b.dueAt) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "update-milestone") {
    const status = String(b.status || "").toUpperCase(); if (!(MILESTONE_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
    const m = await prisma.milestone.findUnique({ where: { id: String(b.milestoneId || "") }, select: { projectId: true } })
    if (!m) return NextResponse.json({ error: "Milestone not found." }, { status: 404 })
    const pr = await prisma.project.findUnique({ where: { id: m.projectId }, select: { ownerId: true } })
    if (pr?.ownerId !== p.userId) return NextResponse.json({ error: "Not your project." }, { status: 403 })
    await prisma.milestone.update({ where: { id: String(b.milestoneId) }, data: { status } })
    return NextResponse.json({ success: true })
  }
  if (action === "add-task") {
    const title = String(b.title || "").trim(); if (!title) return NextResponse.json({ error: "Task title required." }, { status: 400 })
    await prisma.task.create({ data: { employerId: p.userId, createdById: p.userId, projectId: String(b.projectId), title: title.slice(0, 200), status: "TODO", priority: (["LOW", "MEDIUM", "HIGH"].includes(b.priority) ? b.priority : "MEDIUM") } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "move-task") {
    const status = String(b.status || "").toUpperCase(); if (!(TASK_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
    const t = await prisma.task.findUnique({ where: { id: String(b.taskId || "") }, select: { projectId: true, createdById: true } })
    if (!t) return NextResponse.json({ error: "Task not found." }, { status: 404 })
    if (t.createdById !== p.userId) return NextResponse.json({ error: "Not your task." }, { status: 403 })
    await prisma.task.update({ where: { id: String(b.taskId) }, data: { status, completedAt: status === "DONE" ? new Date() : null } })
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
