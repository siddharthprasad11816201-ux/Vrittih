import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { getRates, convertFromCHF, meta } from "@/lib/fx"
import { createCheckoutSession, stripeConfigured } from "@/lib/stripe"
import { JOINING_FEE_CHF } from "@/lib/payment"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 })

    const { currency = "CHF", type = "jobseeker" } = await req.json()
    if (!meta(currency)) return NextResponse.json({ error: "Unsupported currency." }, { status: 400 })

    if (!stripeConfigured()) {
      return NextResponse.json({ error: "Card payments aren't switched on yet — add STRIPE_SECRET_KEY.", configured: false }, { status: 503 })
    }

    const { rates } = await getRates()
    const { minorUnits } = convertFromCHF(JOINING_FEE_CHF, currency, rates[currency] ?? 1)

    const origin = req.headers.get("origin") || process.env.APP_URL || "http://localhost:3000"
    const session = await createCheckoutSession({
      currency, minorUnits, userId: payload.userId, type, feeCHF: JOINING_FEE_CHF, email: payload.email,
      successUrl: `${origin}/pay?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/pay?status=cancelled`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not start checkout." }, { status: 500 })
  }
}
