import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { getRazorpay } from "@/lib/razorpay"
import { recordRedemption } from "@/lib/coupon"

export const dynamic = "force-dynamic"

// Verifies the Razorpay payment signature, then grants access to the REAL
// signed-in user (from the cookie — never trust a userId from the request body).
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment fields" }, { status: 400 })
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex")
    const ok = expected.length === razorpay_signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))
    if (!ok) return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 })

    // Fetch the order server-side (never trust the client for tier/discount). A
    // fetch failure is fatal here — we cannot confirm ownership without it, so we
    // must NOT activate (previously this was swallowed and access still granted).
    let order: any
    try { order = await getRazorpay().orders.fetch(razorpay_order_id) }
    catch { return NextResponse.json({ error: "Could not verify this order. Please contact support." }, { status: 502 }) }

    // Bind the payment to its buyer: create-order stamps notes.userId. A valid
    // signature only proves the payment is real, NOT that it belongs to the
    // caller — without this check a captured (order,payment,signature) triple
    // could activate any/many accounts (paywall bypass).
    const notes = order?.notes || {}
    if (!notes.userId || notes.userId !== payload.userId) {
      return NextResponse.json({ error: "This payment is not associated with your account." }, { status: 403 })
    }
    const planId = (notes.planId as string) || ""
    const couponId = (notes.couponId as string) || ""
    const feeCHF = Number(notes.feeCHF) || 0
    const baseCHF = Number(notes.baseCHF) || feeCHF   // pre-discount, for the audit trail

    const data: any = { paid: true, paidAt: new Date(), paymentId: razorpay_payment_id }
    if (planId) {
      const renews = new Date(); renews.setMonth(renews.getMonth() + 1)
      data.plan = planId; data.planRenewsAt = renews
    }
    await prisma.user.update({ where: { id: payload.userId }, data })

    // Consume a partial coupon only now that payment is confirmed (abandoned
    // checkouts never burn a code). Best-effort — must not fail the activation.
    if (couponId) {
      await recordRedemption(couponId, payload.userId, { planId: planId || null, amountBeforeCHF: baseCHF, amountAfterCHF: feeCHF, waiver: false, orderId: razorpay_order_id }).catch(() => {})
    }
    return NextResponse.json({ success: true, paymentId: razorpay_payment_id, plan: planId || null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
