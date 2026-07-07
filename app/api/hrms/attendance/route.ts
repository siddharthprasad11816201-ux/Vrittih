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
const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const initials = (n?: string) => (n || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()

// GET ?date=YYYY-MM-DD -> today's roster; ?employeeId -> that person's history.
export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId")

  if (employeeId) {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!emp || emp.employerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const history = await prisma.attendance.findMany({ where: { employeeId }, orderBy: { date: "desc" }, take: 30 })
    return NextResponse.json({ history })
  }

  const date = dayStart(searchParams.get("date") ? new Date(searchParams.get("date")!) : new Date())
  const employees = await prisma.employee.findMany({ where: { employerId: p.userId, status: { not: "EXITED" } }, orderBy: { createdAt: "asc" } })
  const users = await prisma.user.findMany({ where: { id: { in: employees.map(e => e.userId) } }, select: { id: true, name: true, avatar: true } })
  const uMap = Object.fromEntries(users.map(u => [u.id, u]))
  const records = await prisma.attendance.findMany({ where: { employeeId: { in: employees.map(e => e.id) }, date } })
  const rMap = Object.fromEntries(records.map(r => [r.employeeId, r]))

  const roster = employees.map(e => ({
    employeeId: e.id, code: e.employeeCode, name: uMap[e.userId]?.name || "—", avatar: uMap[e.userId]?.avatar || null,
    initials: initials(uMap[e.userId]?.name), designation: e.designation,
    attendance: rMap[e.id] || null,
  }))
  const counts = { present: 0, late: 0, remote: 0, leave: 0, absent: 0 }
  for (const r of roster) {
    const s = r.attendance?.status
    if (s === "PRESENT") counts.present++
    else if (s === "LATE") counts.late++
    else if (s === "REMOTE") counts.remote++
    else if (s === "LEAVE" || s === "HOLIDAY") counts.leave++
    else counts.absent++
  }
  return NextResponse.json({ date: date.toISOString().slice(0, 10), roster, counts })
}

// POST { employeeId, action: checkin|checkout|mark, status?, date?, method? }
export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })
  const { employeeId, action, status, date, method } = await req.json()
  if (!employeeId || !action) return NextResponse.json({ error: "employeeId and action required" }, { status: 400 })
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!emp || emp.employerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const day = dayStart(date ? new Date(date) : new Date())
  const now = new Date()
  const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date: day } } })

  if (action === "checkin") {
    // Late if checking in after 09:30 local-ish (uses UTC hour+min against 9:30).
    const late = now.getUTCHours() * 60 + now.getUTCMinutes() > 9 * 60 + 30
    const rec = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: day } },
      update: { checkIn: existing?.checkIn || now, status: existing?.status && ["LEAVE", "HOLIDAY", "REMOTE"].includes(existing.status) ? existing.status : (late ? "LATE" : "PRESENT"), method: method || "manual" },
      create: { employeeId, date: day, checkIn: now, status: late ? "LATE" : "PRESENT", method: method || "manual" },
    })
    return NextResponse.json({ ok: true, attendance: rec })
  }
  if (action === "checkout") {
    if (!existing?.checkIn) return NextResponse.json({ error: "Not checked in yet" }, { status: 400 })
    const workedMins = Math.max(0, Math.round((now.getTime() - existing.checkIn.getTime()) / 60000))
    const rec = await prisma.attendance.update({ where: { id: existing.id }, data: { checkOut: now, workedMins } })
    return NextResponse.json({ ok: true, attendance: rec })
  }
  if (action === "mark") {
    if (!status) return NextResponse.json({ error: "status required" }, { status: 400 })
    const rec = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: day } },
      update: { status, method: method || "manual" },
      create: { employeeId, date: day, status, method: method || "manual" },
    })
    return NextResponse.json({ ok: true, attendance: rec })
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
