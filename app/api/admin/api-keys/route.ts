import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { hashPassword } from "@/lib/hash"
import { generateApiKey, hashApiKey, keyPrefix } from "@/lib/apikey"

export const dynamic = "force-dynamic"
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)

// GET -> list issued keys (never returns the raw token).
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } })
  const emps = await prisma.user.findMany({ where: { id: { in: keys.map(k => k.employerId) } }, select: { id: true, name: true } })
  const m = Object.fromEntries(emps.map(e => [e.id, e.name]))
  return NextResponse.json({ keys: keys.map(k => ({ id: k.id, prefix: k.prefix, company: m[k.employerId] || "—", label: k.label, active: k.active, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt })) })
}

// POST { company, label } -> auto-create the company (employer) if new, issue a key.
// The raw token is returned ONCE.
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  const { company, label } = await req.json()
  if (!company) return NextResponse.json({ error: "company is required" }, { status: 400 })

  const email = `api+${slug(company)}@vrittih.online`
  let employer = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!employer) {
    employer = await prisma.user.create({
      data: { name: company, email, password: await hashPassword(randomBytes(24).toString("hex")), role: "EMPLOYER", paid: true, paidAt: new Date(), idVerified: true, source: "api", profile: { create: {} } },
      select: { id: true },
    })
  }
  const raw = generateApiKey()
  await prisma.apiKey.create({ data: { keyHash: hashApiKey(raw), prefix: keyPrefix(raw), employerId: employer.id, label: label || null } })
  return NextResponse.json({ ok: true, company, key: raw, note: "Save this key now — it is shown only once." })
}
