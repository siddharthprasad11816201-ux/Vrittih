import crypto from "crypto"
import { prisma } from "@/lib/prisma"

/* Outbound webhooks — in-house, HMAC-signed, with backoff retries.
 *
 * A company subscribes an endpoint (POST /api/v1/webhooks). When an event fires
 * (e.g. application.created) we POST a JSON body and sign it so the receiver can
 * verify it came from us:
 *   X-Vrittih-Signature: sha256=<hex HMAC-SHA256(secret, rawBody)>
 * Verify by recomputing the HMAC over the raw request body with your secret.
 *
 * emit() is fire-and-forget and never throws into the caller — a webhook must
 * never break the action that triggered it. Immediate delivery is attempted at
 * emit time; anything still pending is retried by the daily cron (retryDue). */

const MAX_ATTEMPTS = 6
const TIMEOUT_MS = 8000
const AUTO_DISABLE_AFTER = 20 // consecutive failures before we stop trying this endpoint

export function webhookSecret(): string {
  return "whsec_" + crypto.randomBytes(24).toString("hex")
}

export function sign(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex")
}

// Exponential backoff: 1m, 2m, 4m, 8m … capped at 6h.
function backoffMs(attempts: number): number {
  return Math.min(60_000 * 2 ** (attempts - 1), 6 * 3_600_000)
}

/** Deliver one queued delivery now; record the outcome and schedule any retry. */
export async function attempt(deliveryId: string): Promise<void> {
  const d = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { webhook: true } })
  if (!d || !d.webhook || d.status === "delivered") return
  const wh = d.webhook
  const attempts = d.attempts + 1
  const signature = sign(wh.secret, d.payload)

  try {
    const res = await fetch(wh.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "VrittihWebhooks/1.0 (+https://www.vrittih.online)",
        "x-vrittih-event": d.event,
        "x-vrittih-delivery": d.id,
        "x-vrittih-signature": `sha256=${signature}`,
      },
      body: d.payload,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const ok = res.ok
    const done = ok || attempts >= MAX_ATTEMPTS
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: {
        status: ok ? "delivered" : done ? "failed" : "pending",
        attempts, responseCode: res.status,
        lastError: ok ? null : `HTTP ${res.status}`,
        nextRetryAt: done ? null : new Date(Date.now() + backoffMs(attempts)),
      },
    })
    const fails = ok ? 0 : wh.failCount + 1
    await prisma.webhook.update({
      where: { id: wh.id },
      data: { lastStatus: res.status, lastAt: new Date(), failCount: fails, active: fails >= AUTO_DISABLE_AFTER ? false : wh.active },
    })
  } catch (e: any) {
    const done = attempts >= MAX_ATTEMPTS
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: {
        status: done ? "failed" : "pending",
        attempts, lastError: String(e?.message || e).slice(0, 200),
        nextRetryAt: done ? null : new Date(Date.now() + backoffMs(attempts)),
      },
    })
    const fails = wh.failCount + 1
    await prisma.webhook.update({ where: { id: wh.id }, data: { lastAt: new Date(), failCount: fails, active: fails >= AUTO_DISABLE_AFTER ? false : wh.active } })
  }
}

/** Fire an event to all of a company's subscribed, active webhooks. Never throws. */
export async function emit(employerId: string, event: string, data: any): Promise<void> {
  try {
    const hooks = await prisma.webhook.findMany({ where: { employerId, active: true } })
    const subs = hooks.filter((h) => h.events === "*" || h.events.split(",").map((s) => s.trim()).includes(event))
    if (!subs.length) return
    const body = JSON.stringify({ event, at: new Date().toISOString(), data })
    for (const h of subs) {
      const d = await prisma.webhookDelivery.create({ data: { webhookId: h.id, event, payload: body } })
      attempt(d.id).catch(() => {}) // immediate best-effort; cron retries the rest
    }
  } catch {
    /* webhooks must never break the triggering action */
  }
}

/** Retry deliveries whose backoff has elapsed. Called by the daily cron. */
export async function retryDue(limit = 100): Promise<number> {
  const due = await prisma.webhookDelivery.findMany({
    where: { status: "pending", nextRetryAt: { lte: new Date() } },
    orderBy: { nextRetryAt: "asc" }, take: limit,
  })
  for (const d of due) await attempt(d.id)
  return due.length
}
