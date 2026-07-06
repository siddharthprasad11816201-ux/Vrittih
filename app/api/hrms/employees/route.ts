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
const DEFAULT_ONBOARDING = [
  "Offer letter signed", "Documents & ID collected", "Accounts & access created",
  "Workspace / equipment set up", "Induction & orientation", "Buddy / manager assigned",
].map(label => ({ label, done: false }))

// GET -> the employer's team, stats, and hired candidates not yet onboarded.
export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })

  const employees = await prisma.employee.findMany({ where: { employerId: p.userId }, orderBy: { createdAt: "desc" } })
  const userIds = [...new Set(employees.flatMap(e => [e.userId, e.managerId].filter(Boolean) as string[]))]
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, avatar: true, headline: true, idVerified: true } })
  const uMap = Object.fromEntries(users.map(u => [u.id, u]))
  const pendingLeave = await prisma.leaveRequest.count({ where: { employee: { employerId: p.userId }, status: "PENDING" } })

  const withUser = employees.map(e => {
    let steps: any[] = []
    try { steps = JSON.parse(e.onboarding || "[]") } catch {}
    const done = steps.filter(s => s.done).length
    return { ...e, user: uMap[e.userId] || null, manager: e.managerId ? uMap[e.managerId] : null, onboardingPct: steps.length ? Math.round((done / steps.length) * 100) : 100, steps }
  })
  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === "ACTIVE").length,
    onboarding: employees.filter(e => e.status === "ONBOARDING").length,
    onLeave: employees.filter(e => e.status === "ON_LEAVE").length,
    pendingLeave,
  }

  // hired candidates for this employer not yet employees
  const jobs = await prisma.job.findMany({ where: { postedById: p.userId }, select: { id: true } })
  const hired = await prisma.application.findMany({
    where: { jobId: { in: jobs.map(j => j.id) }, status: "HIRED" },
    include: { user: { select: { id: true, name: true, email: true, avatar: true, headline: true } }, job: { select: { title: true } } },
  })
  const empUserIds = new Set(employees.map(e => e.userId))
  const onboardable = hired.filter(a => !empUserIds.has(a.userId))
    .map(a => ({ applicationId: a.id, user: a.user, jobTitle: a.job.title }))

  return NextResponse.json({ employees: withUser, stats, onboardable })
}

// POST -> onboard someone. { applicationId } (from a hired candidate) or { userId, ...fields }.
export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })
  const body = await req.json()

  let userId: string | undefined = body.userId
  if (body.applicationId) {
    const app = await prisma.application.findUnique({ where: { id: body.applicationId }, include: { job: { select: { postedById: true } } } })
    if (!app || app.job.postedById !== p.userId) return NextResponse.json({ error: "Application not found" }, { status: 404 })
    userId = app.userId
  }
  if (!userId) return NextResponse.json({ error: "userId or applicationId required" }, { status: 400 })

  const exists = await prisma.employee.findUnique({ where: { employerId_userId: { employerId: p.userId, userId } } })
  if (exists) return NextResponse.json({ error: "Already an employee." }, { status: 409 })

  const count = await prisma.employee.count({ where: { employerId: p.userId } })
  const employee = await prisma.employee.create({
    data: {
      userId, employerId: p.userId,
      employeeCode: `EMP-${String(count + 1).padStart(4, "0")}`,
      department: body.department || null,
      designation: body.designation || null,
      employmentType: body.employmentType || "Full-time",
      salary: body.salary || null,
      workLocation: body.workLocation || null,
      onboarding: JSON.stringify(DEFAULT_ONBOARDING),
    },
  })
  return NextResponse.json({ ok: true, employee })
}

// PATCH -> update an employee (status/details/onboarding). { id, ...fields }
export async function PATCH(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })
  const { id, toggleStep, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const emp = await prisma.employee.findUnique({ where: { id } })
  if (!emp || emp.employerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const data: any = {}
  for (const k of ["department", "designation", "employmentType", "status", "salary", "workLocation", "managerId"]) {
    if (fields[k] !== undefined) data[k] = fields[k]
  }
  if (typeof toggleStep === "number") {
    let steps: any[] = []
    try { steps = JSON.parse(emp.onboarding || "[]") } catch {}
    if (steps[toggleStep]) steps[toggleStep].done = !steps[toggleStep].done
    data.onboarding = JSON.stringify(steps)
    // auto-activate once fully onboarded
    if (steps.length && steps.every(s => s.done) && emp.status === "ONBOARDING") data.status = "ACTIVE"
  }
  const employee = await prisma.employee.update({ where: { id }, data })
  return NextResponse.json({ ok: true, employee })
}
