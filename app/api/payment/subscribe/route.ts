import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { getRazorpay, razorpayConfigured } from "@/lib/razorpay"

export const dynamic = "force-dynamic"

/* Recurring auto-pay (Razorpay Subscriptions + UPI AutoPay) — OPT-IN, env-gated.
 * Activates only when the owner has enabled Subscriptions in Razorpay and set a
 * plan id (RAZORPAY_SUBSCRIPTION_PLAN_BASIC). Until then it returns a clean
 * "not enabled" so checkout falls back to the free trial / one-time payment.
 * On success it returns a subscription id for Razorpay Checkout (subscription
 * mode); a subscription.charged webhook then activates the plan. */
export async function POST(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  if (!p) return NextResponse.json({ error: "Please sign in." }, { status: 401 })

  const planId = process.env.RAZORPAY_SUBSCRIPTION_PLAN_BASIC
  if (!razorpayConfigured() || !planId) {
    return NextResponse.json({
      enabled: false,
      error: "Auto-renew isn't switched on yet. Start the 7-day free trial or pay once for now — auto-pay (UPI AutoPay / card) will appear here once it's enabled.",
    }, { status: 501 })
  }
  try {
    const sub = await getRazorpay().subscriptions.create({
      plan_id: planId,
      total_count: Number(process.env.RAZORPAY_SUBSCRIPTION_CYCLES) || 12,
      customer_notify: 1,
      notes: { userId: p.userId, type: "basic" },
    } as any)
    return NextResponse.json({ enabled: true, subscriptionId: (sub as any).id, keyId: process.env.RAZORPAY_KEY_ID })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not start the subscription." }, { status: 500 })
  }
}
