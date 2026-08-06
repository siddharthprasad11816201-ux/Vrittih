import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { admissionsFunnel, seatUtilization, placementStats, gpaDistribution, ADMISSION_STATUSES, PROGRAM_LEVELS, STUDENT_STATUSES } from "@/lib/university/campus"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
const str = (v: any, n = 200) => String(v ?? "").slice(0, n)
const oneOf = (v: any, list: readonly string[], d: string) => (list.includes(String(v)) ? String(v) : d)
const numOrNull = (v: any) => (v == null || v === "" ? null : Math.max(0, Number(v) || 0))

// A mutation's institution must belong to the caller.
async function ownsInstitution(id: string, userId: string) {
  const i = await prisma.institution.findUnique({ where: { id }, select: { ownerId: true } })
  return !!i && i.ownerId === userId
}

export async function GET(req: NextRequest) {
  const p = auth(req); if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const institutions = await prisma.institution.findMany({ where: { ownerId: p.userId }, orderBy: { createdAt: "asc" }, take: 100 })
  const sel = req.nextUrl.searchParams.get("institutionId") || institutions[0]?.id || null
  let detail: any = null
  if (sel && institutions.some(i => i.id === sel)) {
    const [programs, admissions, students, faculty, exams] = await Promise.all([
      prisma.program.findMany({ where: { institutionId: sel }, orderBy: { createdAt: "desc" }, take: 300 }),
      prisma.admissionApplication.findMany({ where: { institutionId: sel }, orderBy: { createdAt: "desc" }, take: 1000 }),
      prisma.studentRecord.findMany({ where: { institutionId: sel }, orderBy: { createdAt: "desc" }, take: 2000 }),
      prisma.facultyMember.findMany({ where: { institutionId: sel }, orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.examResult.findMany({ where: { institutionId: sel }, orderBy: { createdAt: "desc" }, take: 1000 }),
    ])
    const active = students.filter(s => s.status === "ACTIVE")
    detail = {
      institutionId: sel, programs, admissions, students, faculty, exams,
      stats: {
        funnel: admissionsFunnel(admissions),
        seats: seatUtilization(programs, active.length),
        placement: placementStats(students),
        gpa: gpaDistribution(students),
        counts: { programs: programs.length, students: students.length, active: active.length, faculty: faculty.length },
      },
    }
  }
  return NextResponse.json({ institutions, selected: sel, detail, meta: { admissionStatuses: ADMISSION_STATUSES, levels: PROGRAM_LEVELS, studentStatuses: STUDENT_STATUSES } })
}

export async function POST(req: NextRequest) {
  const p = auth(req); if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const action = str(b.action, 40)

  if (action === "create-institution") {
    const name = str(b.name).trim(); if (!name) return NextResponse.json({ error: "Institution name required." }, { status: 400 })
    const i = await prisma.institution.create({ data: { ownerId: p.userId, name, kind: oneOf(b.kind, ["UNIVERSITY", "COLLEGE", "SCHOOL"], "UNIVERSITY"), city: b.city ? str(b.city, 120) : null, country: b.country ? str(b.country, 80) : null } })
    return NextResponse.json({ success: true, id: i.id }, { status: 201 })
  }

  const instId = str(b.institutionId, 40)
  if (!instId || !(await ownsInstitution(instId, p.userId))) return NextResponse.json({ error: "Not your institution." }, { status: 403 })

  if (action === "create-program") {
    const name = str(b.name).trim(); if (!name) return NextResponse.json({ error: "Program name required." }, { status: 400 })
    await prisma.program.create({ data: { institutionId: instId, name, department: b.department ? str(b.department, 120) : null, level: oneOf(b.level, PROGRAM_LEVELS, "UG"), durationMonths: Math.max(1, Math.round(Number(b.durationMonths) || 48)), seats: Math.max(0, Math.round(Number(b.seats) || 60)) } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "create-admission") {
    const applicantName = str(b.applicantName).trim(); if (!applicantName) return NextResponse.json({ error: "Applicant name required." }, { status: 400 })
    await prisma.admissionApplication.create({ data: { institutionId: instId, programId: b.programId ? str(b.programId, 40) : null, applicantName, email: b.email ? str(b.email, 160) : null, score: numOrNull(b.score), status: "SUBMITTED" } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "update-admission") {
    const id = str(b.admissionId, 40); const status = oneOf(b.status, ADMISSION_STATUSES, "")
    if (!status) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
    const row = await prisma.admissionApplication.findUnique({ where: { id }, select: { institutionId: true } })
    if (!row || row.institutionId !== instId) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.admissionApplication.update({ where: { id }, data: { status } })
    return NextResponse.json({ success: true })
  }
  if (action === "create-student") {
    const name = str(b.name).trim(); if (!name) return NextResponse.json({ error: "Student name required." }, { status: 400 })
    const count = await prisma.studentRecord.count({ where: { institutionId: instId } })
    await prisma.studentRecord.create({ data: { institutionId: instId, programId: b.programId ? str(b.programId, 40) : null, name, email: b.email ? str(b.email, 160) : null, enrollmentId: str(b.enrollmentId, 40) || `ENR-${String(count + 1).padStart(5, "0")}`, year: Math.max(1, Math.round(Number(b.year) || 1)), gpa: numOrNull(b.gpa), status: "ACTIVE", placed: !!b.placed } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "update-student") {
    const id = str(b.studentId, 40)
    const row = await prisma.studentRecord.findUnique({ where: { id }, select: { institutionId: true } })
    if (!row || row.institutionId !== instId) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const data: any = {}
    if (b.gpa !== undefined) data.gpa = numOrNull(b.gpa)
    if (b.status != null) data.status = oneOf(b.status, STUDENT_STATUSES, "ACTIVE")
    if (b.placed !== undefined) data.placed = !!b.placed
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    await prisma.studentRecord.update({ where: { id }, data })
    return NextResponse.json({ success: true })
  }
  if (action === "create-faculty") {
    const name = str(b.name).trim(); if (!name) return NextResponse.json({ error: "Faculty name required." }, { status: 400 })
    await prisma.facultyMember.create({ data: { institutionId: instId, name, department: b.department ? str(b.department, 120) : null, designation: b.designation ? str(b.designation, 120) : null, email: b.email ? str(b.email, 160) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "create-exam") {
    const course = str(b.course).trim(); if (!course) return NextResponse.json({ error: "Course required." }, { status: 400 })
    await prisma.examResult.create({ data: { institutionId: instId, studentId: b.studentId ? str(b.studentId, 40) : null, course, term: b.term ? str(b.term, 40) : null, score: Math.max(0, Number(b.score) || 0), maxScore: Math.max(1, Number(b.maxScore) || 100) } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
