import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"

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

    await prisma.user.update({
      where: { id: payload.userId },
      data: { paid: true, paidAt: new Date(), paymentId: razorpay_payment_id },
    })
    return NextResponse.json({ success: true, paymentId: razorpay_payment_id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
