import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { generateApiKey, hashApiKey, keyPrefix } from "@/lib/apikey"
import { featureGate } from "@/lib/guard"

export const dynamic = "force-dynamic"

/* Self-serve API keys. A logged-in company (employer/admin) can mint, list and
 * revoke its OWN keys here — no admin required. The key authenticates the public
 * Partner API (/api/v1/*) as this same account, so jobs it posts attribute to
 * the company. The raw token is returned exactly once, at creation. */

// Only companies (and staff) get API access — a jobseeker account has nothing to integrate.
const CAN_INTEGRATE = ["EMPLOYER", "ADMIN", "SUPER_ADMIN"]

function auth(req: NextRequest) {
  const token = req.cookies.get("er_token")?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return { error: "Not authenticated", status: 401 as const }
  if (!CAN_INTEGRATE.includes(payload.role)) return { error: "API access is for company accounts. Switch to an employer account to create keys.", status: 403 as const }
  return { payload }
}

// GET -> this account's keys (never the raw token).
export async function GET(req: NextRequest) {
  const a = auth(req)
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status })
  const keys = await prisma.apiKey.findMany({ where: { employerId: a.payload.userId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({
    keys: keys.map((k) => ({ id: k.id, prefix: k.prefix, label: k.label, active: k.active, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt })),
  })
}

// POST { label? } -> mint a new key for this account. Raw token shown once.
export async function POST(req: NextRequest) {
  const a = auth(req)
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status })
  // Minting keys is a Scale-tier capability (the Developer API).
  const gate = await featureGate(req, "api"); if (gate instanceof NextResponse) return gate
  const body = await req.json().catch(() => ({}))
  const label = typeof body.label === "string" ? body.label.slice(0, 80) : null

  // Keep the number of active keys sane per account.
  const active = await prisma.apiKey.count({ where: { employerId: a.payload.userId, active: true } })
  if (active >= 20) return NextResponse.json({ error: "Key limit reached (20 active). Revoke one first." }, { status: 400 })

  const raw = generateApiKey()
  const rec = await prisma.apiKey.create({
    data: { keyHash: hashApiKey(raw), prefix: keyPrefix(raw), employerId: a.payload.userId, label },
    select: { id: true, prefix: true, label: true, createdAt: true },
  })
  return NextResponse.json({ ok: true, key: raw, id: rec.id, prefix: rec.prefix, label: rec.label, note: "Save this key now — it is shown only once." }, { status: 201 })
}

// DELETE { id } -> revoke one of this account's keys (soft: active=false).
export async function DELETE(req: NextRequest) {
  const a = auth(req)
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || "")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  // Scope to the owner so one company can't revoke another's key.
  const rec = await prisma.apiKey.findFirst({ where: { id, employerId: a.payload.userId } })
  if (!rec) return NextResponse.json({ error: "Key not found" }, { status: 404 })
  await prisma.apiKey.update({ where: { id: rec.id }, data: { active: false } })
  return NextResponse.json({ ok: true, id: rec.id, revoked: true })
}
