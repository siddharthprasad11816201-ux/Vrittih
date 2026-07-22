import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { computePayslip, parseComponents, validateStructure, TEMPLATE_IN, TEMPLATE_FLAT } from "@/lib/payroll"

export const dynamic = "force-dynamic"

function auth(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  if (!t) return null
  const p = verifyToken(t)
  if (!p || !["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(p.role || "")) return null
  return p
}

// GET ?employeeId= -> that employee's structure plus a live preview of one month.
export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })
  const employeeId = req.nextUrl.searchParams.get("employeeId") || ""

  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, employerId: true } })
  if (!emp || emp.employerId !== p.userId) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

  const c = await prisma.compensation.findUnique({ where: { employeeId } })
  if (!c) return NextResponse.json({ compensation: null, templates: { india: TEMPLATE_IN, flat: TEMPLATE_FLAT } })

  const components = parseComponents(c.components)
  return NextResponse.json({
    compensation: { currency: c.currency, annualCTC: c.annualCTC, components, effectiveFrom: c.effectiveFrom, note: c.note },
    preview: computePayslip({ annualCTC: c.annualCTC, currency: c.currency, components }),
    templates: { india: TEMPLATE_IN, flat: TEMPLATE_FLAT },
  })
}

// PUT { employeeId, currency, annualCTC, components[], note? } -> save a structure.
// Validated before saving: a structure that computes nonsense is worse than none.
export async function PUT(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })
  const b = await req.json().catch(() => ({}))

  const emp = await prisma.employee.findUnique({ where: { id: b.employeeId || "" }, select: { id: true, employerId: true } })
  if (!emp || emp.employerId !== p.userId) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

  const annualCTC = Number(b.annualCTC)
  const components = Array.isArray(b.components) ? b.components : []
  const errors = validateStructure(annualCTC, components)
  if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 })

  const currency = String(b.currency || "INR").toUpperCase().slice(0, 3)
  const data = {
    currency, annualCTC, components: JSON.stringify(components),
    note: b.note ? String(b.note).slice(0, 500) : null,
    effectiveFrom: b.effectiveFrom ? new Date(b.effectiveFrom) : new Date(),
  }
  await prisma.compensation.upsert({
    where: { employeeId: emp.id },
    update: data,
    create: { employeeId: emp.id, ...data },
  })

  return NextResponse.json({
    ok: true,
    preview: computePayslip({ annualCTC, currency, components }),
  })
}
