import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { featureGate } from "@/lib/guard"

export const dynamic = "force-dynamic"

const STATUSES = ["TODO", "DOING", "DONE"]
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"]

/* Task / assignment management (Growth+). Scoped to the employer; assignees are
 * the company's own employees. Used by the /tasks board and the partner API. */

async function withAssignees(rows: any[]) {
  const ids = [...new Set(rows.map((t) => t.assigneeId).filter(Boolean))] as string[]
  if (!ids.length) return rows.map((t) => ({ ...t, assignee: null }))
  const emps = await prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, userId: true, employeeCode: true } })
  const users = await prisma.user.findMany({ where: { id: { in: emps.map((e) => e.userId) } }, select: { id: true, name: true } })
  const uName: Record<string, string> = {}; for (const u of users) uName[u.id] = u.name
  const byId: Record<string, any> = {}; for (const e of emps) byId[e.id] = { id: e.id, name: uName[e.userId] || e.employeeCode }
  return rows.map((t) => ({ ...t, assignee: t.assigneeId ? byId[t.assigneeId] || null : null }))
}

export async function GET(req: NextRequest) {
  const g = await featureGate(req, "tasks")
  if (g instanceof NextResponse) return g
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")?.toUpperCase()
  const where: any = { employerId: g.user.id }
  if (status && STATUSES.includes(status)) where.status = status
  const rows = await prisma.task.findMany({ where, orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }], take: 500 })
  return NextResponse.json({ count: rows.length, tasks: await withAssignees(rows) })
}

export async function POST(req: NextRequest) {
  const g = await featureGate(req, "tasks")
  if (g instanceof NextResponse) return g
  const body = await req.json().catch(() => ({}))
  const title = String(body.title || "").trim()
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 })
  const priority = PRIORITIES.includes(String(body.priority || "").toUpperCase()) ? String(body.priority).toUpperCase() : "MEDIUM"
  const status = STATUSES.includes(String(body.status || "").toUpperCase()) ? String(body.status).toUpperCase() : "TODO"

  // An assignee must be one of this company's own employees.
  let assigneeId: string | null = null
  if (body.assigneeId) {
    const emp = await prisma.employee.findFirst({ where: { id: String(body.assigneeId), employerId: g.user.id }, select: { id: true } })
    if (!emp) return NextResponse.json({ error: "assigneeId must be one of your employees" }, { status: 400 })
    assigneeId = emp.id
  }
  const dueAt = body.dueAt ? new Date(body.dueAt) : null
  if (body.dueAt && isNaN(dueAt!.getTime())) return NextResponse.json({ error: "Invalid dueAt" }, { status: 400 })

  const task = await prisma.task.create({
    data: {
      employerId: g.user.id, createdById: g.user.id,
      title: title.slice(0, 300), description: body.description ? String(body.description).slice(0, 5000) : null,
      priority, status, assigneeId, dueAt, completedAt: status === "DONE" ? new Date() : null,
    },
  })
  return NextResponse.json({ ok: true, task: (await withAssignees([task]))[0] }, { status: 201 })
}
