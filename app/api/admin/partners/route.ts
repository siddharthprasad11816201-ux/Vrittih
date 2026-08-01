import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAction } from "@/lib/admin"

export const dynamic = "force-dynamic"

/* Admin review of API partners. A company that integrates must be approved here
 * before its API-posted jobs go public (the second half of the go-live gate,
 * alongside domain verification). */

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  // Partners = accounts that have issued at least one API key.
  const keys = await prisma.apiKey.groupBy({ by: ["employerId"], _count: { _all: true } })
  const ids = keys.map((k) => k.employerId)
  const keyCount: Record<string, number> = {}; for (const k of keys) keyCount[k.employerId] = k._count._all
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, plan: true, apiApproved: true, createdAt: true } })
  const domains = await prisma.partnerDomain.findMany({ where: { employerId: { in: ids } }, select: { employerId: true, domain: true, verified: true } })
  const domByEmp: Record<string, any[]> = {}
  for (const d of domains) (domByEmp[d.employerId] ||= []).push({ domain: d.domain, verified: d.verified })
  const liveJobs = await prisma.job.groupBy({ by: ["postedById"], where: { postedById: { in: ids }, active: true }, _count: { _all: true } })
  const liveBy: Record<string, number> = {}; for (const l of liveJobs) liveBy[l.postedById] = l._count._all

  return NextResponse.json({
    partners: users.map((u) => ({
      id: u.id, name: u.name, email: u.email, plan: u.plan, approved: u.apiApproved, createdAt: u.createdAt,
      keys: keyCount[u.id] || 0, domains: domByEmp[u.id] || [], verifiedDomains: (domByEmp[u.id] || []).filter((d) => d.verified).length, liveJobs: liveBy[u.id] || 0,
    })).sort((a, b) => Number(a.approved) - Number(b.approved)),
  })
}

// POST { employerId, approved } -> approve or revoke a partner for public posting.
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  const { employerId, approved } = await req.json().catch(() => ({}))
  if (!employerId) return NextResponse.json({ error: "employerId is required" }, { status: 400 })
  const u = await prisma.user.findUnique({ where: { id: employerId }, select: { id: true } })
  if (!u) return NextResponse.json({ error: "Partner not found" }, { status: 404 })
  await prisma.user.update({ where: { id: employerId }, data: { apiApproved: approved !== false } })
  await logAction(admin.userId, approved !== false ? "partner.approve" : "partner.revoke", { employerId }, req)
  return NextResponse.json({ ok: true, employerId, approved: approved !== false })
}
