import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { featureGate } from "@/lib/guard"

export const dynamic = "force-dynamic"

const STATUSES = ["TODO", "DOING", "DONE"]
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"]

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await featureGate(req, "tasks")
  if (g instanceof NextResponse) return g
  const existing = await prisma.task.findFirst({ where: { id: params.id, employerId: g.user.id } })
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: any = {}
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 300)
  if (typeof body.description === "string") data.description = body.description.slice(0, 5000)
  if (body.priority && PRIORITIES.includes(String(body.priority).toUpperCase())) data.priority = String(body.priority).toUpperCase()
  if (body.status && STATUSES.includes(String(body.status).toUpperCase())) {
    data.status = String(body.status).toUpperCase()
    data.completedAt = data.status === "DONE" ? new Date() : null
  }
  if (body.dueAt === null) data.dueAt = null
  else if (body.dueAt) { const d = new Date(body.dueAt); if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid dueAt" }, { status: 400 }); data.dueAt = d }
  if (body.assigneeId === null) data.assigneeId = null
  else if (body.assigneeId) {
    const emp = await prisma.employee.findFirst({ where: { id: String(body.assigneeId), employerId: g.user.id }, select: { id: true } })
    if (!emp) return NextResponse.json({ error: "assigneeId must be one of your employees" }, { status: 400 })
    data.assigneeId = emp.id
  }

  const task = await prisma.task.update({ where: { id: existing.id }, data })
  return NextResponse.json({ ok: true, task })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await featureGate(req, "tasks")
  if (g instanceof NextResponse) return g
  const existing = await prisma.task.findFirst({ where: { id: params.id, employerId: g.user.id } })
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 })
  await prisma.task.delete({ where: { id: existing.id } })
  return NextResponse.json({ ok: true, id: existing.id, removed: true })
}
