import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authApiKey } from "@/lib/apikey"
import { domainToken, normalizeDomain, checkDomain, verifyInstructions } from "@/lib/partnerVerify"

export const dynamic = "force-dynamic"

/* Partner API — prove you control the domains your jobs link to.
 * POST   /api/v1/domains { domain, method? }   -> register + get verification instructions
 * POST   /api/v1/domains { domain, verify:true } -> run the check now
 * GET    /api/v1/domains                        -> list your domains + status
 * DELETE /api/v1/domains { domain }             -> remove one */

export async function GET(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  const rows = await prisma.partnerDomain.findMany({ where: { employerId: ctx.employerId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({
    domains: rows.map((d) => ({
      domain: d.domain, method: d.method, verified: d.verified, verifiedAt: d.verifiedAt,
      instructions: d.verified ? undefined : verifyInstructions(d.domain, d.token),
    })),
  })
}

export async function POST(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }
  const domain = normalizeDomain(body.domain)
  if (!domain) return NextResponse.json({ error: "A valid domain is required, e.g. \"acme.com\"." }, { status: 400 })
  const method = body.method === "file" ? "file" : "dns"

  let rec = await prisma.partnerDomain.findUnique({ where: { employerId_domain: { employerId: ctx.employerId, domain } } })

  // Verify path
  if (body.verify) {
    if (!rec) return NextResponse.json({ error: "Register the domain first (POST { domain })." }, { status: 400 })
    if (rec.verified) return NextResponse.json({ ok: true, domain, verified: true })
    const r = await checkDomain(domain, rec.token, rec.method)
    if (r.ok) {
      rec = await prisma.partnerDomain.update({ where: { id: rec.id }, data: { verified: true, verifiedAt: new Date() } })
      return NextResponse.json({ ok: true, domain, verified: true })
    }
    return NextResponse.json({ ok: false, domain, verified: false, detail: r.detail, instructions: verifyInstructions(domain, rec.token) }, { status: 400 })
  }

  // Register (or return existing) path
  if (!rec) rec = await prisma.partnerDomain.create({ data: { employerId: ctx.employerId, domain, token: domainToken(), method } })
  else if (rec.method !== method) rec = await prisma.partnerDomain.update({ where: { id: rec.id }, data: { method } })

  return NextResponse.json({
    ok: true, domain, verified: rec.verified, method: rec.method,
    instructions: verifyInstructions(domain, rec.token),
    note: "Add the record/file, then POST { domain, verify: true } to confirm.",
  }, { status: rec.verified ? 200 : 201 })
}

export async function DELETE(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const domain = normalizeDomain(body.domain)
  if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 })
  const rec = await prisma.partnerDomain.findUnique({ where: { employerId_domain: { employerId: ctx.employerId, domain } } })
  if (!rec) return NextResponse.json({ error: "Domain not found" }, { status: 404 })
  await prisma.partnerDomain.delete({ where: { id: rec.id } })
  return NextResponse.json({ ok: true, domain, removed: true })
}
