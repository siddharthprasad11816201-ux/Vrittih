import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authApiKey } from "@/lib/apikey"
import { safeExternalUrl } from "@/lib/url"
import { webhookSecret } from "@/lib/webhooks"

export const dynamic = "force-dynamic"

/* Partner API — webhook subscriptions.
 * POST /api/v1/webhooks { url, events? }  -> subscribe (secret returned ONCE)
 * GET  /api/v1/webhooks                    -> list this company's subscriptions
 * DELETE /api/v1/webhooks { id }           -> remove one
 * Events: "application.created", "job.expired" (or "*" for all).
 * We POST { event, at, data } signed with X-Vrittih-Signature: sha256=<hmac>. */

const KNOWN_EVENTS = ["application.created", "application.updated", "job.expired"]

export async function GET(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  const hooks = await prisma.webhook.findMany({ where: { employerId: ctx.employerId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({
    webhooks: hooks.map((h) => ({ id: h.id, url: h.url, events: h.events, active: h.active, createdAt: h.createdAt, lastStatus: h.lastStatus, lastAt: h.lastAt, failCount: h.failCount })),
  })
}

export async function POST(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }

  const url = safeExternalUrl(body.url)
  if (!url) return NextResponse.json({ error: "A valid https url is required." }, { status: 400 })
  // Only https for webhooks — we sign, but the receiver's URL must be encrypted.
  if (!url.startsWith("https://")) return NextResponse.json({ error: "Webhook url must be https." }, { status: 400 })

  let events = "*"
  if (Array.isArray(body.events) && body.events.length) {
    const bad = body.events.filter((e: string) => !KNOWN_EVENTS.includes(e))
    if (bad.length) return NextResponse.json({ error: `Unknown events: ${bad.join(", ")}. Known: ${KNOWN_EVENTS.join(", ")} (or omit for all).` }, { status: 400 })
    events = body.events.join(",")
  }

  const active = await prisma.webhook.count({ where: { employerId: ctx.employerId, active: true } })
  if (active >= 20) return NextResponse.json({ error: "Webhook limit reached (20). Remove one first." }, { status: 400 })

  const secret = webhookSecret()
  const wh = await prisma.webhook.create({ data: { employerId: ctx.employerId, url, secret, events } })
  return NextResponse.json({
    ok: true, id: wh.id, url: wh.url, events: wh.events,
    secret, note: "Save this signing secret now — it is shown only once. Verify X-Vrittih-Signature with it.",
  }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || "")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  const wh = await prisma.webhook.findFirst({ where: { id, employerId: ctx.employerId } })
  if (!wh) return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
  await prisma.webhook.delete({ where: { id: wh.id } })
  return NextResponse.json({ ok: true, id: wh.id, removed: true })
}
