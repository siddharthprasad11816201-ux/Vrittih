import { NextRequest, NextResponse } from "next/server"
import { protectSecret } from "@/lib/crypto/storedSecret"
import { prisma } from "@/lib/prisma"
import { featureGate } from "@/lib/guard"
import { safeExternalUrl } from "@/lib/url"
import { webhookSecret } from "@/lib/webhooks"

export const dynamic = "force-dynamic"

/* Cookie-authed webhook management for the Developer portal (same as the
 * /api/v1/webhooks partner API, for a logged-in company). Gated to "api" (Scale). */

const KNOWN_EVENTS = ["application.created", "application.updated", "job.expired"]

export async function GET(req: NextRequest) {
  const g = await featureGate(req, "api")
  if (g instanceof NextResponse) return g
  const hooks = await prisma.webhook.findMany({ where: { employerId: g.user.id }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({
    events: KNOWN_EVENTS,
    webhooks: hooks.map((h) => ({ id: h.id, url: h.url, events: h.events, active: h.active, createdAt: h.createdAt, lastStatus: h.lastStatus, lastAt: h.lastAt, failCount: h.failCount })),
  })
}

export async function POST(req: NextRequest) {
  const g = await featureGate(req, "api")
  if (g instanceof NextResponse) return g
  const body = await req.json().catch(() => ({}))
  const url = safeExternalUrl(body.url)
  if (!url || !url.startsWith("https://")) return NextResponse.json({ error: "A valid https url is required." }, { status: 400 })

  let events = "*"
  if (Array.isArray(body.events) && body.events.length) {
    const bad = body.events.filter((e: string) => !KNOWN_EVENTS.includes(e))
    if (bad.length) return NextResponse.json({ error: `Unknown events: ${bad.join(", ")}.` }, { status: 400 })
    events = body.events.join(",")
  }
  const active = await prisma.webhook.count({ where: { employerId: g.user.id, active: true } })
  if (active >= 20) return NextResponse.json({ error: "Webhook limit reached (20). Remove one first." }, { status: 400 })

  const secret = webhookSecret()
  // Stored encrypted; the plaintext is returned once below and never again.
  const wh = await prisma.webhook.create({ data: { employerId: g.user.id, url, secret: protectSecret(secret), events } })
  return NextResponse.json({ ok: true, id: wh.id, url: wh.url, events: wh.events, secret, note: "Save this signing secret now — it is shown only once." }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const g = await featureGate(req, "api")
  if (g instanceof NextResponse) return g
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || "")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  const wh = await prisma.webhook.findFirst({ where: { id, employerId: g.user.id } })
  if (!wh) return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
  await prisma.webhook.delete({ where: { id: wh.id } })
  return NextResponse.json({ ok: true, id: wh.id, removed: true })
}
