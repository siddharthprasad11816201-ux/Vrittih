import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { getRazorpay, razorpayConfigured } from "@/lib/razorpay"
import { getRates, convertFromCHF, meta } from "@/lib/fx"
import { JOINING_FEE_CHF } from "@/lib/payment"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 })

    const { currency = "CHF", type = "jobseeker" } = await req.json()
    if (!meta(currency)) return NextResponse.json({ error: "Unsupported currency." }, { status: 400 })

    if (!razorpayConfigured()) {
      return NextResponse.json({ error: "Card payments aren't switched on yet — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.", configured: false }, { status: 503 })
    }

    const { rates } = await getRates()
    const { amount, minorUnits } = convertFromCHF(JOINING_FEE_CHF, currency, rates[currency] ?? 1)

    const order = await getRazorpay().orders.create({
      amount: minorUnits,               // smallest currency subunit
      currency,
      receipt: `vrittih_${payload.userId}_${Date.now()}`.slice(0, 40),
      notes: { userId: payload.userId, type, feeCHF: String(JOINING_FEE_CHF) },
    })

    return NextResponse.json({
      orderId: order.id, amount: order.amount, currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, displayAmount: amount, name: "Vrittih",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not start payment." }, { status: 500 })
  }
}
