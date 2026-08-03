import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/* Razorpay webhook — activates a plan on recurring charge. Env-gated by
 * RAZORPAY_WEBHOOK_SECRET (set it + the webhook URL in the Razorpay dashboard to
 * enable auto-renew). Verifies the HMAC signature over the raw body, then on a
 * subscription charge marks the user paid for the next cycle. */
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ ok: true, ignored: "webhooks not configured" })

  const raw = await req.text()
  const sig = req.headers.get("x-razorpay-signature") || ""
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex")
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 })
  }

  let event: any
  try { event = JSON.parse(raw) } catch { return NextResponse.json({ error: "bad body" }, { status: 400 }) }

  if (event.event === "subscription.charged" || event.event === "subscription.activated") {
    const sub = event.payload?.subscription?.entity
    const userId = sub?.notes?.userId
    const planId = sub?.notes?.type || "basic"
    if (userId) {
      const renews = new Date(); renews.setMonth(renews.getMonth() + 1)
      await prisma.user.update({ where: { id: userId }, data: { paid: true, plan: planId, planRenewsAt: renews, paidAt: new Date() } }).catch(() => {})
    }
  } else if (event.event === "subscription.cancelled" || event.event === "subscription.halted") {
    const userId = event.payload?.subscription?.entity?.notes?.userId
    if (userId) await prisma.user.update({ where: { id: userId }, data: { plan: "free" } }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
