import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { computePayslip, parseComponents, periodLabel } from "@/lib/payroll"

export const dynamic = "force-dynamic"

function auth(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  if (!t) return null
  const p = verifyToken(t)
  if (!p) return null
  if (!["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(p.role || "")) return null
  return p
}

// GET -> payroll runs for this employer, plus who is payroll-ready.
export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })

  const runs = await prisma.payrollRun.findMany({
    where: { employerId: p.userId },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    take: 24,
    include: { _count: { select: { payslips: true } } },
  })

  const employees = await prisma.employee.findMany({
    where: { employerId: p.userId, status: { in: ["ACTIVE", "ONBOARDING", "ON_LEAVE"] } },
    select: { id: true, userId: true, employeeCode: true, department: true, designation: true, status: true },
  })
  const comps = await prisma.compensation.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) } },
    select: { employeeId: true, currency: true, annualCTC: true, components: true },
  })
  const compBy = Object.fromEntries(comps.map((c) => [c.employeeId, c]))
  const users = await prisma.user.findMany({
    where: { id: { in: employees.map((e) => e.userId) } },
    select: { id: true, name: true, email: true },
  })
  const userBy = Object.fromEntries(users.map((u) => [u.id, u]))

  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id, periodYear: r.periodYear, periodMonth: r.periodMonth,
      label: periodLabel(r.periodYear, r.periodMonth),
      status: r.status, currency: r.currency,
      totalGross: r.totalGross, totalDeduct: r.totalDeduct, totalNet: r.totalNet,
      headcount: r._count.payslips, approvedAt: r.approvedAt, paidAt: r.paidAt,
    })),
    employees: employees.map((e) => ({
      id: e.id, name: userBy[e.userId]?.name || "—", email: userBy[e.userId]?.email,
      code: e.employeeCode, department: e.department, designation: e.designation, status: e.status,
      compensation: compBy[e.id]
        ? { currency: compBy[e.id].currency, annualCTC: compBy[e.id].annualCTC, components: parseComponents(compBy[e.id].components) }
        : null,
    })),
  })
}

// POST { periodYear, periodMonth, workingDays?, lop?: {employeeId: days} }
// -> compute (or recompute) a DRAFT run. Only employees with a saved structure
// are included; everyone else is reported back as skipped rather than silently
// paid zero.
export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const now = new Date()
  const periodYear = parseInt(body.periodYear, 10) || now.getUTCFullYear()
  const periodMonth = parseInt(body.periodMonth, 10) || now.getUTCMonth() + 1
  if (periodMonth < 1 || periodMonth > 12) return NextResponse.json({ error: "periodMonth must be 1-12." }, { status: 400 })
  const workingDays = Math.max(1, parseInt(body.workingDays, 10) || 30)
  const lop: Record<string, number> = body.lop && typeof body.lop === "object" ? body.lop : {}

  const existing = await prisma.payrollRun.findUnique({
    where: { employerId_periodYear_periodMonth: { employerId: p.userId, periodYear, periodMonth } },
  })
  if (existing && existing.status !== "DRAFT") {
    return NextResponse.json({ error: `${periodLabel(periodYear, periodMonth)} is already ${existing.status.toLowerCase()} and cannot be recomputed.` }, { status: 409 })
  }

  const employees = await prisma.employee.findMany({
    where: { employerId: p.userId, status: { in: ["ACTIVE", "ONBOARDING", "ON_LEAVE"] } },
    select: { id: true, userId: true },
  })
  const comps = await prisma.compensation.findMany({ where: { employeeId: { in: employees.map((e) => e.id) } } })
  const compBy = Object.fromEntries(comps.map((c) => [c.employeeId, c]))

  const payable = employees.filter((e) => compBy[e.id])
  const skipped = employees.filter((e) => !compBy[e.id]).map((e) => e.id)
  if (!payable.length) {
    return NextResponse.json({ error: "No employee has a salary structure yet. Set compensation first.", skipped: skipped.length }, { status: 400 })
  }

  // Mixed currencies cannot be summed into one run total honestly.
  const currencies = [...new Set(payable.map((e) => compBy[e.id].currency))]
  if (currencies.length > 1) {
    return NextResponse.json({ error: `This run mixes currencies (${currencies.join(", ")}). Run payroll separately per currency so the totals mean something.` }, { status: 400 })
  }
  const currency = currencies[0]

  const slips = payable.map((e) => {
    const c = compBy[e.id]
    const s = computePayslip({
      annualCTC: c.annualCTC, currency: c.currency,
      components: parseComponents(c.components),
      workingDays, lopDays: Number(lop[e.id]) || 0,
    })
    return { employeeId: e.id, ...s }
  })

  const totalGross = Math.round(slips.reduce((n, s) => n + s.gross, 0) * 100) / 100
  const totalDeduct = Math.round(slips.reduce((n, s) => n + s.deductions, 0) * 100) / 100
  const totalNet = Math.round(slips.reduce((n, s) => n + s.net, 0) * 100) / 100

  const run = await prisma.$transaction(async (tx) => {
    const r = existing
      ? await tx.payrollRun.update({ where: { id: existing.id }, data: { currency, totalGross, totalDeduct, totalNet, headcount: slips.length, status: "DRAFT" } })
      : await tx.payrollRun.create({ data: { employerId: p.userId, periodYear, periodMonth, currency, totalGross, totalDeduct, totalNet, headcount: slips.length } })
    await tx.payslip.deleteMany({ where: { runId: r.id } })
    await tx.payslip.createMany({
      data: slips.map((s) => ({
        runId: r.id, employeeId: s.employeeId, currency: s.currency,
        gross: s.gross, deductions: s.deductions, net: s.net,
        lines: JSON.stringify(s.lines), lopDays: s.lopDays, paidDays: s.paidDays,
      })),
    })
    return r
  })

  return NextResponse.json({
    ok: true, runId: run.id, label: periodLabel(periodYear, periodMonth),
    currency, headcount: slips.length, totalGross, totalDeduct, totalNet,
    skipped: skipped.length,
    note: skipped.length ? `${skipped.length} employee(s) have no salary structure and were left out of this run.` : undefined,
  })
}

// PATCH { runId, action: "approve" | "paid" | "cancel" }
export async function PATCH(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Employer access required" }, { status: 403 })
  const { runId, action } = await req.json().catch(() => ({}))
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
  if (!run || run.employerId !== p.userId) return NextResponse.json({ error: "Run not found" }, { status: 404 })

  const next: Record<string, { from: string[]; set: any }> = {
    approve: { from: ["DRAFT"], set: { status: "APPROVED", approvedAt: new Date() } },
    paid: { from: ["APPROVED"], set: { status: "PAID", paidAt: new Date() } },
    cancel: { from: ["DRAFT", "APPROVED"], set: { status: "CANCELLED" } },
  }
  const step = next[action]
  if (!step) return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  if (!step.from.includes(run.status)) {
    return NextResponse.json({ error: `Cannot ${action} a run that is ${run.status.toLowerCase()}.` }, { status: 409 })
  }
  await prisma.payrollRun.update({ where: { id: run.id }, data: step.set })
  return NextResponse.json({ ok: true, status: step.set.status })
}
