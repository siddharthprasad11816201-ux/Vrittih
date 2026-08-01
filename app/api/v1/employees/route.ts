import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authApiKey } from "@/lib/apikey"
import { hashPassword } from "@/lib/hash"
import { randomBytes } from "crypto"

export const dynamic = "force-dynamic"

/* Partner API — read the company's HR roster into external tools.
 * GET /api/v1/employees   ?status=ACTIVE  ?limit=200
 * Auth: Bearer vk_live_… (scoped to that company). Employee<->User is a scalar
 * link in this schema, so the person's name/email is joined manually. */

export async function GET(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")?.toUpperCase()
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "200", 10) || 200, 1), 500)

  const where: any = { employerId: ctx.employerId }
  if (status) where.status = status

  const employees = await prisma.employee.findMany({ where, orderBy: { joinedAt: "desc" }, take: limit })
  const users = await prisma.user.findMany({ where: { id: { in: employees.map((e) => e.userId) } }, select: { id: true, name: true, email: true } })
  const u: Record<string, { name: string; email: string }> = {}
  for (const x of users) u[x.id] = { name: x.name, email: x.email }

  return NextResponse.json({
    count: employees.length,
    employees: employees.map((e) => ({
      id: e.id, employeeCode: e.employeeCode,
      name: u[e.userId]?.name || null, email: u[e.userId]?.email || null,
      department: e.department, designation: e.designation, employmentType: e.employmentType,
      status: e.status, managerId: e.managerId, workLocation: e.workLocation,
      joinedAt: e.joinedAt, leaveBalance: e.leaveBalance,
    })),
  })
}

// POST -> add an employee by email. Links to an existing Vrittih user if one has
// that email, otherwise creates a lightweight record for the person. Idempotent
// per (company, person): re-posting the same email returns 409.
export async function POST(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }

  const email = String(body.email || "").trim().toLowerCase()
  const name = String(body.name || "").trim()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

  let user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) {
    user = await prisma.user.create({
      data: { name: name.slice(0, 120), email, password: await hashPassword(randomBytes(24).toString("hex")), role: "JOBSEEKER", source: "api-hire", profile: { create: {} } },
      select: { id: true },
    })
  }

  const exists = await prisma.employee.findUnique({ where: { employerId_userId: { employerId: ctx.employerId, userId: user.id } }, select: { id: true } })
  if (exists) return NextResponse.json({ error: "This person is already an employee.", employeeId: exists.id }, { status: 409 })

  const count = await prisma.employee.count({ where: { employerId: ctx.employerId } })
  const employee = await prisma.employee.create({
    data: {
      userId: user.id, employerId: ctx.employerId,
      employeeCode: `EMP-${String(count + 1).padStart(4, "0")}`,
      department: body.department ? String(body.department).slice(0, 100) : null,
      designation: body.designation ? String(body.designation).slice(0, 100) : null,
      employmentType: body.employmentType ? String(body.employmentType).slice(0, 50) : "Full-time",
      salary: body.salary ? String(body.salary).slice(0, 300) : null,
      workLocation: body.workLocation ? String(body.workLocation).slice(0, 100) : null,
      joinedAt: body.joinedAt ? new Date(body.joinedAt) : new Date(),
    },
  })
  return NextResponse.json({ ok: true, employee: { id: employee.id, employeeCode: employee.employeeCode, name, email, department: employee.department, designation: employee.designation, status: employee.status } }, { status: 201 })
}
