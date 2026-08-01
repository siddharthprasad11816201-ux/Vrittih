import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { featureGate } from "@/lib/guard"
import { domainToken, normalizeDomain, checkDomain, verifyInstructions } from "@/lib/partnerVerify"

export const dynamic = "force-dynamic"

/* Cookie-authed domain management for the Developer portal (same as the
 * /api/v1/domains partner API, but for a logged-in company). Gated to the API
 * tier ("api" = Scale). */

export async function GET(req: NextRequest) {
  const g = await featureGate(req, "api")
  if (g instanceof NextResponse) return g
  const rows = await prisma.partnerDomain.findMany({ where: { employerId: g.user.id }, orderBy: { createdAt: "desc" } })
  const approved = (await prisma.user.findUnique({ where: { id: g.user.id }, select: { apiApproved: true } }))?.apiApproved || false
  return NextResponse.json({
    approved,
    domains: rows.map((d) => ({ domain: d.domain, method: d.method, verified: d.verified, verifiedAt: d.verifiedAt, instructions: d.verified ? undefined : verifyInstructions(d.domain, d.token) })),
  })
}

export async function POST(req: NextRequest) {
  const g = await featureGate(req, "api")
  if (g instanceof NextResponse) return g
  const body = await req.json().catch(() => ({}))
  const domain = normalizeDomain(body.domain)
  if (!domain) return NextResponse.json({ error: "A valid domain is required, e.g. \"acme.com\"." }, { status: 400 })
  const method = body.method === "file" ? "file" : "dns"

  let rec = await prisma.partnerDomain.findUnique({ where: { employerId_domain: { employerId: g.user.id, domain } } })

  if (body.verify) {
    if (!rec) return NextResponse.json({ error: "Add the domain first." }, { status: 400 })
    if (rec.verified) return NextResponse.json({ ok: true, domain, verified: true })
    const r = await checkDomain(domain, rec.token, rec.method)
    if (r.ok) { await prisma.partnerDomain.update({ where: { id: rec.id }, data: { verified: true, verifiedAt: new Date() } }); return NextResponse.json({ ok: true, domain, verified: true }) }
    return NextResponse.json({ ok: false, domain, verified: false, detail: r.detail, instructions: verifyInstructions(domain, rec.token) }, { status: 400 })
  }

  if (!rec) rec = await prisma.partnerDomain.create({ data: { employerId: g.user.id, domain, token: domainToken(), method } })
  else if (rec.method !== method) rec = await prisma.partnerDomain.update({ where: { id: rec.id }, data: { method } })
  return NextResponse.json({ ok: true, domain, verified: rec.verified, method: rec.method, instructions: verifyInstructions(domain, rec.token) }, { status: rec.verified ? 200 : 201 })
}

export async function DELETE(req: NextRequest) {
  const g = await featureGate(req, "api")
  if (g instanceof NextResponse) return g
  const body = await req.json().catch(() => ({}))
  const domain = normalizeDomain(body.domain)
  if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 })
  const rec = await prisma.partnerDomain.findUnique({ where: { employerId_domain: { employerId: g.user.id, domain } } })
  if (!rec) return NextResponse.json({ error: "Domain not found" }, { status: 404 })
  await prisma.partnerDomain.delete({ where: { id: rec.id } })
  return NextResponse.json({ ok: true, domain, removed: true })
}
