import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"

export const dynamic = "force-dynamic"
const canView = (ctx: any) => ctx.has("hrms.view") || ctx.has("admin.access")
const jarr = (s?: string | null) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }

/* Phase 4 — Org chart (derived from Employee.managerId) + succession plans. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canView(ctx)) return NextResponse.json({ error: "HR/manager access required." }, { status: 403 })
  const [employees, succession] = await Promise.all([
    prisma.employee.findMany({ where: ctx.has("admin.access") ? {} : { employerId: ctx.userId }, select: { id: true, userId: true, designation: true, department: true, managerId: true, status: true }, take: 2000 }),
    prisma.successionPlan.findMany({ where: { ownerId: ctx.userId }, orderBy: { updatedAt: "desc" }, take: 100 }),
  ])
  const userIds = employees.map(e => e.userId)
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : []
  const nameById = new Map(users.map(u => [u.id, u.name]))
  return NextResponse.json({
    employees: employees.map(e => ({ id: e.id, name: nameById.get(e.userId) || "—", designation: e.designation, department: e.department, managerId: e.managerId, status: e.status })),
    succession: succession.map(s => ({ id: s.id, positionTitle: s.positionTitle, candidates: jarr(s.candidates), notes: s.notes })),
  })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canView(ctx)) return NextResponse.json({ error: "HR/manager access required." }, { status: 403 })
  const b = await req.json()
  const positionTitle = String(b.positionTitle || "").trim()
  if (!positionTitle) return NextResponse.json({ error: "Position title required." }, { status: 400 })
  const candidates = Array.isArray(b.candidates) ? b.candidates.slice(0, 20).map((c: any) => ({ name: String(c.name || "").slice(0, 120), readiness: String(c.readiness || "developing").slice(0, 20), note: c.note ? String(c.note).slice(0, 300) : undefined })) : []
  const s = await prisma.successionPlan.create({ data: { ownerId: ctx.userId, positionTitle: positionTitle.slice(0, 160), candidates: JSON.stringify(candidates), notes: b.notes ? String(b.notes).slice(0, 2000) : null } })
  return NextResponse.json({ success: true, id: s.id }, { status: 201 })
}
