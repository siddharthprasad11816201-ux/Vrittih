import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { appointmentStats, populationHealth, triageRouting, APPOINTMENT_STATUSES, RECORD_KINDS } from "@/lib/healthcare/clinical"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
const str = (v: any, n = 200) => String(v ?? "").slice(0, n)
const oneOf = (v: any, list: readonly string[], d: string) => (list.includes(String(v)) ? String(v) : d)
async function ownsFacility(id: string, userId: string) { const f = await prisma.healthFacility.findUnique({ where: { id }, select: { ownerId: true } }); return !!f && f.ownerId === userId }

export async function GET(req: NextRequest) {
  const p = auth(req); if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const facilities = await prisma.healthFacility.findMany({ where: { ownerId: p.userId }, orderBy: { createdAt: "asc" }, take: 100 })
  const sel = req.nextUrl.searchParams.get("facilityId") || facilities[0]?.id || null
  let detail: any = null
  if (sel && facilities.some(f => f.id === sel)) {
    const [patients, appts] = await Promise.all([
      prisma.patient.findMany({ where: { facilityId: sel }, orderBy: { createdAt: "desc" }, take: 1000 }),
      prisma.appointment.findMany({ where: { facilityId: sel }, orderBy: { scheduledAt: "desc" }, take: 1000 }),
    ])
    const recSet = new Set((await prisma.medicalRecord.findMany({ where: { facilityId: sel }, select: { patientId: true }, take: 20000 })).map(r => r.patientId))
    detail = { facilityId: sel, patients, appointments: appts, stats: { appointments: appointmentStats(appts), population: populationHealth(patients), recordsCoverage: patients.length ? Math.round((recSet.size / patients.length) * 100) : 0 } }
  }
  return NextResponse.json({ facilities, selected: sel, detail, meta: { appointmentStatuses: APPOINTMENT_STATUSES, recordKinds: RECORD_KINDS } })
}

export async function POST(req: NextRequest) {
  const p = auth(req); if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json(); const action = str(b.action, 40)

  if (action === "triage") return NextResponse.json({ triage: triageRouting(str(b.complaint, 500)) })  // operational routing (no auth-scoped data)

  if (action === "create-facility") {
    const name = str(b.name).trim(); if (!name) return NextResponse.json({ error: "Facility name required." }, { status: 400 })
    const f = await prisma.healthFacility.create({ data: { ownerId: p.userId, name, kind: oneOf(b.kind, ["HOSPITAL", "CLINIC"], "HOSPITAL"), city: b.city ? str(b.city, 120) : null } })
    return NextResponse.json({ success: true, id: f.id }, { status: 201 })
  }
  const facilityId = str(b.facilityId, 40)
  if (!facilityId || !(await ownsFacility(facilityId, p.userId))) return NextResponse.json({ error: "Not your facility." }, { status: 403 })

  if (action === "create-patient") {
    const name = str(b.name).trim(); if (!name) return NextResponse.json({ error: "Patient name required." }, { status: 400 })
    const count = await prisma.patient.count({ where: { facilityId } })
    await prisma.patient.create({ data: { facilityId, name, mrn: str(b.mrn, 40) || `MRN-${String(count + 1).padStart(6, "0")}`, dob: b.dob ? new Date(b.dob) : null, sex: b.sex ? str(b.sex, 20) : null, bloodGroup: b.bloodGroup ? str(b.bloodGroup, 5) : null, phone: b.phone ? str(b.phone, 40) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "create-appointment") {
    if (!b.scheduledAt) return NextResponse.json({ error: "scheduledAt required." }, { status: 400 })
    await prisma.appointment.create({ data: { facilityId, patientId: b.patientId ? str(b.patientId, 40) : null, doctorName: b.doctorName ? str(b.doctorName, 120) : null, department: b.department ? str(b.department, 80) : null, scheduledAt: new Date(b.scheduledAt), status: "SCHEDULED", reason: b.reason ? str(b.reason, 500) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "update-appointment") {
    const id = str(b.appointmentId, 40); const status = oneOf(b.status, APPOINTMENT_STATUSES, "")
    if (!status) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
    const row = await prisma.appointment.findUnique({ where: { id }, select: { facilityId: true } })
    if (!row || row.facilityId !== facilityId) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.appointment.update({ where: { id }, data: { status } })
    return NextResponse.json({ success: true })
  }
  if (action === "create-record") {
    const patientId = str(b.patientId, 40); if (!patientId) return NextResponse.json({ error: "patientId required." }, { status: 400 })
    const pat = await prisma.patient.findUnique({ where: { id: patientId }, select: { facilityId: true } })
    if (!pat || pat.facilityId !== facilityId) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.medicalRecord.create({ data: { facilityId, patientId, kind: oneOf(b.kind, RECORD_KINDS, "VISIT"), summary: b.summary ? str(b.summary, 2000) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
