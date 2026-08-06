import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { grievanceSLA, schemeReach, serviceBacklog, AGENCY_LEVELS, SCHEME_STATUSES, REQUEST_KINDS, REQUEST_STATUSES, PRIORITIES } from "@/lib/government/policy"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
const str = (v: any, n = 200) => String(v ?? "").slice(0, n)
const oneOf = (v: any, list: readonly string[], d: string) => (list.includes(String(v)) ? String(v) : d)
async function ownsAgency(id: string, userId: string) { const a = await prisma.govAgency.findUnique({ where: { id }, select: { ownerId: true } }); return !!a && a.ownerId === userId }

export async function GET(req: NextRequest) {
  const p = auth(req); if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const agencies = await prisma.govAgency.findMany({ where: { ownerId: p.userId }, orderBy: { createdAt: "asc" }, take: 100 })
  const sel = req.nextUrl.searchParams.get("agencyId") || agencies[0]?.id || null
  let detail: any = null
  if (sel && agencies.some(a => a.id === sel)) {
    const [schemes, requests] = await Promise.all([
      prisma.scheme.findMany({ where: { agencyId: sel }, orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.citizenRequest.findMany({ where: { agencyId: sel }, orderBy: { createdAt: "desc" }, take: 1000 }),
    ])
    detail = { agencyId: sel, schemes, requests, stats: { sla: grievanceSLA(requests), reach: schemeReach(schemes), backlog: serviceBacklog(requests) } }
  }
  return NextResponse.json({ agencies, selected: sel, detail, meta: { levels: AGENCY_LEVELS, schemeStatuses: SCHEME_STATUSES, requestKinds: REQUEST_KINDS, requestStatuses: REQUEST_STATUSES, priorities: PRIORITIES } })
}

export async function POST(req: NextRequest) {
  const p = auth(req); if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json(); const action = str(b.action, 40)

  if (action === "create-agency") {
    const name = str(b.name).trim(); if (!name) return NextResponse.json({ error: "Agency name required." }, { status: 400 })
    const a = await prisma.govAgency.create({ data: { ownerId: p.userId, name, level: oneOf(b.level, AGENCY_LEVELS, "LOCAL") } })
    return NextResponse.json({ success: true, id: a.id }, { status: 201 })
  }
  const agencyId = str(b.agencyId, 40)
  if (!agencyId || !(await ownsAgency(agencyId, p.userId))) return NextResponse.json({ error: "Not your agency." }, { status: 403 })

  if (action === "create-scheme") {
    const name = str(b.name).trim(); if (!name) return NextResponse.json({ error: "Scheme name required." }, { status: 400 })
    await prisma.scheme.create({ data: { agencyId, name, category: b.category ? str(b.category, 60) : null, budget: Math.max(0, Number(b.budget) || 0), currency: str(b.currency || "CHF", 3).toUpperCase(), beneficiaries: Math.max(0, Math.round(Number(b.beneficiaries) || 0)), status: oneOf(b.status, SCHEME_STATUSES, "ACTIVE") } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "create-request") {
    const subject = str(b.subject).trim(); if (!subject) return NextResponse.json({ error: "Subject required." }, { status: 400 })
    await prisma.citizenRequest.create({ data: { agencyId, kind: oneOf(b.kind, REQUEST_KINDS, "SERVICE"), citizenName: str(b.citizenName || "Citizen", 120), subject, details: b.details ? str(b.details, 4000) : null, category: b.category ? str(b.category, 60) : null, priority: oneOf(b.priority, PRIORITIES, "MEDIUM"), slaDays: Math.max(1, Math.round(Number(b.slaDays) || 15)), status: "OPEN" } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "update-request") {
    const id = str(b.requestId, 40); const status = oneOf(b.status, REQUEST_STATUSES, "")
    if (!status) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
    const row = await prisma.citizenRequest.findUnique({ where: { id }, select: { agencyId: true } })
    if (!row || row.agencyId !== agencyId) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.citizenRequest.update({ where: { id }, data: { status, resolvedAt: (status === "RESOLVED" || status === "REJECTED") ? new Date() : null } })
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
