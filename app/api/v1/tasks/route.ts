import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authApiKey } from "@/lib/apikey"

export const dynamic = "force-dynamic"

const STATUSES = ["TODO", "DOING", "DONE"]
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"]

/* Partner API — task/assignment management from external tools.
 * GET  /api/v1/tasks   ?status=  ?assigneeId=  ?limit=
 * POST /api/v1/tasks   { title, description?, priority?, status?, assigneeId?, dueAt? }
 * Auth: Bearer vk_live_… (scoped to that company). Assignee must be an employee. */

export async function GET(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")?.toUpperCase()
  const assigneeId = searchParams.get("assigneeId") || undefined
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "200", 10) || 200, 1), 500)
  const where: any = { employerId: ctx.employerId }
  if (status && STATUSES.includes(status)) where.status = status
  if (assigneeId) where.assigneeId = assigneeId
  const tasks = await prisma.task.findMany({ where, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: limit })
  return NextResponse.json({ count: tasks.length, tasks })
}

export async function POST(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }
  const title = String(body.title || "").trim()
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 })
  const priority = PRIORITIES.includes(String(body.priority || "").toUpperCase()) ? String(body.priority).toUpperCase() : "MEDIUM"
  const status = STATUSES.includes(String(body.status || "").toUpperCase()) ? String(body.status).toUpperCase() : "TODO"

  let assigneeId: string | null = null
  if (body.assigneeId) {
    const emp = await prisma.employee.findFirst({ where: { id: String(body.assigneeId), employerId: ctx.employerId }, select: { id: true } })
    if (!emp) return NextResponse.json({ error: "assigneeId must be one of your employees" }, { status: 400 })
    assigneeId = emp.id
  }
  const dueAt = body.dueAt ? new Date(body.dueAt) : null
  if (body.dueAt && isNaN(dueAt!.getTime())) return NextResponse.json({ error: "Invalid dueAt" }, { status: 400 })

  const task = await prisma.task.create({
    data: {
      employerId: ctx.employerId, createdById: ctx.employerId,
      title: title.slice(0, 300), description: body.description ? String(body.description).slice(0, 5000) : null,
      priority, status, assigneeId, dueAt, completedAt: status === "DONE" ? new Date() : null,
    },
  })
  return NextResponse.json({ ok: true, task }, { status: 201 })
}
