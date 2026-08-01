import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authApiKey } from "@/lib/apikey"

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
