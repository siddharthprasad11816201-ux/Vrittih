import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"

const EMPLOYER_ROLES = ["EMPLOYER", "ADMIN", "SUPER_ADMIN"]
const auth = (req: NextRequest) => {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  return p && EMPLOYER_ROLES.includes(p.role) ? p : null
}
const daysBetween = (a: Date, b: Date) => Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1)

// GET -> all leave requests for this employer's team, newest first, with employee name.
export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })
  const leaves = await prisma.leaveRequest.findMany({
    where: { employee: { employerId: p.userId } },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  })
  const userIds = [...new Set(leaves.map(l => l.employee.userId))]
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, avatar: true } })
  const uMap = Object.fromEntries(users.map(u => [u.id, u]))
  return NextResponse.json({
    leaves: leaves.map(l => ({
      id: l.id, type: l.type, startDate: l.startDate, endDate: l.endDate, days: l.days,
      reason: l.reason, status: l.status, note: l.note, createdAt: l.createdAt,
      employeeId: l.employeeId, employeeCode: l.employee.employeeCode,
      employee: uMap[l.employee.userId] || { name: "Employee" },
    })),
  })
}

// POST { employeeId, type, startDate, endDate, reason } -> new PENDING request.
export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })
  const { employeeId, type, startDate, endDate, reason } = await req.json()
  if (!employeeId || !startDate || !endDate) return NextResponse.json({ error: "employeeId, startDate, endDate required" }, { status: 400 })
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!emp || emp.employerId !== p.userId) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  const s = new Date(startDate), e = new Date(endDate)
  const leave = await prisma.leaveRequest.create({
    data: { employeeId, type: type || "Annual", startDate: s, endDate: e, days: daysBetween(s, e), reason: reason || null },
  })
  return NextResponse.json({ ok: true, leave })
}

// PATCH { id, status: APPROVED|REJECTED, note } -> decide; deduct balance on approval.
export async function PATCH(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })
  const { id, status, note } = await req.json()
  if (!id || !["APPROVED", "REJECTED"].includes(status)) return NextResponse.json({ error: "id and valid status required" }, { status: 400 })
  const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } })
  if (!leave || leave.employee.employerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (leave.status !== "PENDING") return NextResponse.json({ error: "Already decided" }, { status: 409 })

  const updated = await prisma.leaveRequest.update({ where: { id }, data: { status, note: note || null, decidedAt: new Date() } })
  if (status === "APPROVED" && leave.type === "Annual") {
    await prisma.employee.update({ where: { id: leave.employeeId }, data: { leaveBalance: Math.max(0, leave.employee.leaveBalance - leave.days) } })
  }
  return NextResponse.json({ ok: true, leave: updated })
}
