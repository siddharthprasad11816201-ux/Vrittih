import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authApiKey } from "@/lib/apikey"
import { computePayslip, parseComponents, periodLabel } from "@/lib/payroll"

export const dynamic = "force-dynamic"

/* Partner API — read payroll runs into external finance/HR tools.
 * GET /api/v1/payroll   ?year=2026  ?status=PAID  ?limit=50
 * Auth: Bearer vk_live_… (scoped to that company). Read-only: runs are computed
 * and approved in the Vrittih HRMS UI; this exposes them for reconciliation. */

export async function GET(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined
  const status = searchParams.get("status")?.toUpperCase()
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 200)

  const where: any = { employerId: ctx.employerId }
  if (year && !isNaN(year)) where.periodYear = year
  if (status) where.status = status

  const runs = await prisma.payrollRun.findMany({
    where, orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }], take: limit,
    include: { _count: { select: { payslips: true } } },
  })

  return NextResponse.json({
    count: runs.length,
    runs: runs.map((r) => ({
      id: r.id, periodYear: r.periodYear, periodMonth: r.periodMonth, status: r.status,
      currency: r.currency, totalGross: r.totalGross, totalDeduct: r.totalDeduct, totalNet: r.totalNet,
      headcount: r.headcount, payslips: r._count.payslips, approvedAt: r.approvedAt, paidAt: r.paidAt, createdAt: r.createdAt,
    })),
  })
}

// POST { periodYear, periodMonth, workingDays?, lop? } -> compute a DRAFT run for
// every employee that has a salary structure. Refuses mixed currencies. Mirrors
// the in-app HRMS payroll engine.
export async function POST(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const now = new Date()
  const periodYear = parseInt(body.periodYear, 10) || now.getUTCFullYear()
  const periodMonth = parseInt(body.periodMonth, 10) || now.getUTCMonth() + 1
  if (periodMonth < 1 || periodMonth > 12) return NextResponse.json({ error: "periodMonth must be 1-12." }, { status: 400 })
  const workingDays = Math.max(1, parseInt(body.workingDays, 10) || 30)
  const lop: Record<string, number> = body.lop && typeof body.lop === "object" ? body.lop : {}

  const existing = await prisma.payrollRun.findUnique({ where: { employerId_periodYear_periodMonth: { employerId: ctx.employerId, periodYear, periodMonth } } })
  if (existing && existing.status !== "DRAFT") return NextResponse.json({ error: `${periodLabel(periodYear, periodMonth)} is already ${existing.status.toLowerCase()} and cannot be recomputed.` }, { status: 409 })

  const employees = await prisma.employee.findMany({ where: { employerId: ctx.employerId, status: { in: ["ACTIVE", "ONBOARDING", "ON_LEAVE"] } }, select: { id: true } })
  const comps = await prisma.compensation.findMany({ where: { employeeId: { in: employees.map((e) => e.id) } } })
  const compBy = Object.fromEntries(comps.map((c) => [c.employeeId, c]))
  const payable = employees.filter((e) => compBy[e.id])
  const skipped = employees.length - payable.length
  if (!payable.length) return NextResponse.json({ error: "No employee has a salary structure yet. Set compensation first.", skipped }, { status: 400 })

  const currencies = [...new Set(payable.map((e) => compBy[e.id].currency))]
  if (currencies.length > 1) return NextResponse.json({ error: `This run mixes currencies (${currencies.join(", ")}). Run payroll separately per currency.` }, { status: 400 })
  const currency = currencies[0]

  const slips = payable.map((e) => {
    const c = compBy[e.id]
    return { employeeId: e.id, ...computePayslip({ annualCTC: c.annualCTC, currency: c.currency, components: parseComponents(c.components), workingDays, lopDays: Number(lop[e.id]) || 0 }) }
  })
  const totalGross = Math.round(slips.reduce((n, s) => n + s.gross, 0) * 100) / 100
  const totalDeduct = Math.round(slips.reduce((n, s) => n + s.deductions, 0) * 100) / 100
  const totalNet = Math.round(slips.reduce((n, s) => n + s.net, 0) * 100) / 100

  const run = await prisma.$transaction(async (tx) => {
    const r = existing
      ? await tx.payrollRun.update({ where: { id: existing.id }, data: { currency, totalGross, totalDeduct, totalNet, headcount: slips.length, status: "DRAFT" } })
      : await tx.payrollRun.create({ data: { employerId: ctx.employerId, periodYear, periodMonth, currency, totalGross, totalDeduct, totalNet, headcount: slips.length } })
    await tx.payslip.deleteMany({ where: { runId: r.id } })
    await tx.payslip.createMany({ data: slips.map((s) => ({ runId: r.id, employeeId: s.employeeId, currency: s.currency, gross: s.gross, deductions: s.deductions, net: s.net, lines: JSON.stringify(s.lines), lopDays: s.lopDays, paidDays: s.paidDays })) })
    return r
  })

  return NextResponse.json({ ok: true, runId: run.id, label: periodLabel(periodYear, periodMonth), status: "DRAFT", currency, headcount: slips.length, totalGross, totalDeduct, totalNet, skipped }, { status: 201 })
}

// PATCH { runId, action: "approve" | "paid" | "cancel" } -> advance a run.
export async function PATCH(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  const { runId, action } = await req.json().catch(() => ({}))
  const run = await prisma.payrollRun.findFirst({ where: { id: String(runId || ""), employerId: ctx.employerId } })
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 })
  const next: Record<string, { from: string[]; set: any }> = {
    approve: { from: ["DRAFT"], set: { status: "APPROVED", approvedAt: new Date() } },
    paid: { from: ["APPROVED"], set: { status: "PAID", paidAt: new Date() } },
    cancel: { from: ["DRAFT", "APPROVED"], set: { status: "CANCELLED" } },
  }
  const step = next[action]
  if (!step) return NextResponse.json({ error: "Unknown action (approve | paid | cancel)." }, { status: 400 })
  if (!step.from.includes(run.status)) return NextResponse.json({ error: `Cannot ${action} a run that is ${run.status.toLowerCase()}.` }, { status: 409 })
  await prisma.payrollRun.update({ where: { id: run.id }, data: step.set })
  return NextResponse.json({ ok: true, runId: run.id, status: step.set.status })
}
