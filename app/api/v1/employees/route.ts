import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authApiKey } from "@/lib/apikey"

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
