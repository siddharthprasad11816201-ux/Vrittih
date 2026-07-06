import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { generateDkimKeyPair, dkimDnsRecord } from "@/lib/dkim"

export const dynamic = "force-dynamic"

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

function requireEmployer(req: NextRequest) {
  const token = req.cookies.get("er_token")?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return { error: "Not authenticated", status: 401 as const }
  if (!["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(payload.role)) {
    return { error: "Only employers can manage sending domains", status: 403 as const }
  }
  return { payload }
}

// DNS records the employer must publish (shared shape for POST + verify).
function dnsRecords(domain: string, selector: string, verifyToken: string, dnsPublicKey: string) {
  return [
    { type: "TXT", host: `_vrittih.${domain}`, value: `vrittih-verify=${verifyToken}`, purpose: "Domain ownership" },
    { type: "TXT", host: `${selector}._domainkey.${domain}`, value: dkimDnsRecord(dnsPublicKey), purpose: "DKIM public key" },
    { type: "TXT", host: domain, value: "v=spf1 include:mail.vrittih.online ~all", purpose: "SPF (authorise our servers)" },
  ]
}

export async function GET(req: NextRequest) {
  const auth = requireEmployer(req)
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const domains = await prisma.emailDomain.findMany({
    where: { userId: auth.payload.userId },
    select: { id: true, domain: true, selector: true, verified: true, verifiedAt: true, verifyToken: true, dkimPublicKey: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({
    domains: domains.map((d) => ({
      id: d.id, domain: d.domain, selector: d.selector, verified: d.verified, verifiedAt: d.verifiedAt, createdAt: d.createdAt,
      records: dnsRecords(d.domain, d.selector, d.verifyToken, d.dkimPublicKey),
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = requireEmployer(req)
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { domain } = await req.json()
  const clean = String(domain || "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  if (!DOMAIN_RE.test(clean)) return NextResponse.json({ error: "Enter a valid domain (e.g. acme-corp.com)" }, { status: 400 })

  const existing = await prisma.emailDomain.findUnique({ where: { domain: clean } })
  if (existing) return NextResponse.json({ error: "That domain is already registered" }, { status: 409 })

  const keys = generateDkimKeyPair()
  const selector = "vrittih"
  const vt = randomBytes(16).toString("hex")
  const created = await prisma.emailDomain.create({
    data: {
      userId: auth.payload.userId, domain: clean, selector,
      dkimPrivateKey: keys.privateKeyPem, dkimPublicKey: keys.dnsPublicKey, verifyToken: vt,
    },
    select: { id: true, domain: true, selector: true, verified: true, createdAt: true },
  })
  return NextResponse.json({
    success: true,
    domain: { ...created, records: dnsRecords(clean, selector, vt, keys.dnsPublicKey) },
  }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = requireEmployer(req)
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await req.json()
  const d = await prisma.emailDomain.findUnique({ where: { id } })
  if (!d || d.userId !== auth.payload.userId) return NextResponse.json({ error: "Domain not found" }, { status: 404 })
  await prisma.emailDomain.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
