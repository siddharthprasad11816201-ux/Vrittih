import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authApiKey } from "@/lib/apikey"
import { computePayslip, validateStructure } from "@/lib/payroll"

export const dynamic = "force-dynamic"

const STATUSES = ["ONBOARDING", "ACTIVE", "ON_LEAVE", "EXITED"]

/* PATCH /api/v1/employees/:id — update an employee and/or set their salary
 * structure. Body may include: department, designation, employmentType, status,
 * salary, workLocation, managerId, and a `compensation` object
 * { currency, annualCTC, components[] }. Scoped to the caller's company. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  const emp = await prisma.employee.findFirst({ where: { id: params.id, employerId: ctx.employerId } })
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }

  const data: any = {}
  if (typeof body.department === "string") data.department = body.department.slice(0, 100)
  if (typeof body.designation === "string") data.designation = body.designation.slice(0, 100)
  if (typeof body.employmentType === "string") data.employmentType = body.employmentType.slice(0, 50)
  if (typeof body.workLocation === "string") data.workLocation = body.workLocation.slice(0, 100)
  if (typeof body.salary === "string") data.salary = body.salary.slice(0, 300)
  if (body.status && STATUSES.includes(String(body.status).toUpperCase())) data.status = String(body.status).toUpperCase()
  if (body.managerId === null) data.managerId = null
  else if (body.managerId) {
    const mgr = await prisma.employee.findFirst({ where: { id: String(body.managerId), employerId: ctx.employerId }, select: { id: true } })
    if (!mgr) return NextResponse.json({ error: "managerId must be one of your employees" }, { status: 400 })
    data.managerId = mgr.id
  }
  if (Object.keys(data).length) await prisma.employee.update({ where: { id: emp.id }, data })

  // Optional: set/replace the salary structure used by payroll.
  let compPreview: any = undefined
  if (body.compensation && typeof body.compensation === "object") {
    const c = body.compensation
    const annualCTC = Number(c.annualCTC)
    const components = Array.isArray(c.components) ? c.components : []
    const errors = validateStructure(annualCTC, components)
    if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 })
    const currency = String(c.currency || "INR").toUpperCase().slice(0, 3)
    const cdata = { currency, annualCTC, components: JSON.stringify(components), note: c.note ? String(c.note).slice(0, 500) : null, effectiveFrom: c.effectiveFrom ? new Date(c.effectiveFrom) : new Date() }
    await prisma.compensation.upsert({ where: { employeeId: emp.id }, update: cdata, create: { employeeId: emp.id, ...cdata } })
    compPreview = computePayslip({ annualCTC, currency, components })
  }

  const updated = await prisma.employee.findUnique({ where: { id: emp.id } })
  return NextResponse.json({ ok: true, employee: { id: updated!.id, employeeCode: updated!.employeeCode, department: updated!.department, designation: updated!.designation, status: updated!.status, managerId: updated!.managerId }, ...(compPreview ? { compensationPreview: compPreview } : {}) })
}
