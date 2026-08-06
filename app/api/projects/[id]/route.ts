import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { projectProgress, isAtRisk, kanban, PROJECT_STATUSES } from "@/lib/project/health"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const project = await prisma.project.findUnique({ where: { id: params.id }, include: { milestones: { orderBy: { order: "asc" } } } })
  if (!project || project.ownerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const tasks = await prisma.task.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" }, take: 500 })
  const wiki = await prisma.wikiPage.findMany({ where: { projectId: params.id }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, updatedAt: true } })
  const mDone = project.milestones.filter(m => m.status === "DONE").length
  const tDone = tasks.filter(t => t.status === "DONE").length
  const progress = projectProgress({ milestonesDone: mDone, milestonesTotal: project.milestones.length, tasksDone: tDone, tasksTotal: tasks.length })
  return NextResponse.json({
    project: { id: project.id, name: project.name, description: project.description, status: project.status, dueAt: project.dueAt, startAt: project.startAt },
    milestones: project.milestones,
    board: kanban(tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority }))),
    wiki, progress, atRisk: isAtRisk({ status: project.status, dueAt: project.dueAt, progress }), statuses: PROJECT_STATUSES,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { ownerId: true } })
  if (!project || project.ownerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const b = await req.json()
  const data: any = {}
  if (b.status !== undefined) { const s = String(b.status).toUpperCase(); if (!(PROJECT_STATUSES as readonly string[]).includes(s)) return NextResponse.json({ error: "Invalid status." }, { status: 400 }); data.status = s }
  if (b.name !== undefined) data.name = String(b.name).slice(0, 200)
  if (b.description !== undefined) data.description = b.description ? String(b.description).slice(0, 4000) : null
  if (b.dueAt !== undefined) data.dueAt = b.dueAt ? new Date(b.dueAt) : null
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  await prisma.project.update({ where: { id: params.id }, data })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { ownerId: true } })
  if (!project || project.ownerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await prisma.task.updateMany({ where: { projectId: params.id }, data: { projectId: null } })
  await prisma.wikiPage.deleteMany({ where: { projectId: params.id } })
  await prisma.project.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
