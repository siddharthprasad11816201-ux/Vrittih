import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { getRazorpay, razorpayConfigured } from "@/lib/razorpay"
import { getRates, convertFromCHF, meta } from "@/lib/fx"
import { JOINING_FEE_CHF } from "@/lib/payment"
// Charge the LIVE price, not the shipped default — an admin price change must
// reach checkout, otherwise the customer is billed an amount nobody set.
import { getEffectivePlan } from "@/lib/pricing"
import { validateCoupon } from "@/lib/coupon"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 })

    const { currency = "CHF", type = "jobseeker", planId, couponCode } = await req.json()
    if (!meta(currency)) return NextResponse.json({ error: "Unsupported currency." }, { status: 400 })

    const plan = planId ? await getEffectivePlan(planId) : null
    if (planId && !plan) return NextResponse.json({ error: "Unknown plan." }, { status: 400 })
    const baseCHF = plan ? plan.priceCHF : JOINING_FEE_CHF
    let amountCHF = baseCHF
    if (amountCHF <= 0) return NextResponse.json({ error: "This plan is free — no payment needed." }, { status: 400 })

    // Coupon (server-side authority for the discount). A full waiver must go
    // through /api/payment/redeem-waiver (no charge) — never create a 0 order here.
    let appliedCouponId = "", appliedCouponCode = "", discountCHF = 0
    if (couponCode) {
      // Audience is derived from the ACTUAL plan, never the client-supplied `type`
      // — otherwise an individual-scoped coupon could be applied to an employer plan.
      const audience = plan ? plan.audience : "individual"
      const v = await validateCoupon(String(couponCode), { userId: payload.userId, planId: planId || null, audience, amountCHF })
      if (!v.ok || !v.coupon) return NextResponse.json({ error: v.reason || "This code isn't valid." }, { status: 400 })
      if (v.waiver || v.finalCHF <= 0) return NextResponse.json({ error: "This code covers the full amount — activate for free.", waiver: true }, { status: 400 })
      appliedCouponId = v.coupon.id; appliedCouponCode = v.code || ""; discountCHF = v.discountCHF
      amountCHF = v.finalCHF
    }

    if (!razorpayConfigured()) {
      return NextResponse.json({ error: "Card payments aren't switched on yet — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.", configured: false }, { status: 503 })
    }

    const { rates } = await getRates()
    const { amount, minorUnits } = convertFromCHF(amountCHF, currency, rates[currency] ?? 1)

    const order = await getRazorpay().orders.create({
      amount: minorUnits,               // smallest currency subunit
      currency,
      receipt: `vrittih_${payload.userId}_${Date.now()}`.slice(0, 40),
      notes: { userId: payload.userId, type, planId: planId || "", feeCHF: String(amountCHF), baseCHF: String(baseCHF), discountCHF: String(discountCHF), couponId: appliedCouponId, couponCode: appliedCouponCode },
    })

    return NextResponse.json({
      orderId: order.id, amount: order.amount, currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, displayAmount: amount, name: "Vrittih", planId: planId || null,
      couponCode: appliedCouponCode || null, discountCHF,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not start payment." }, { status: 500 })
  }
}
