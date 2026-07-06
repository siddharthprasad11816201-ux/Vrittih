import { NextRequest, NextResponse } from "next/server"
import { razorpay } from "@/lib/razorpay"
import { JOINING_FEE_CHF } from "@/lib/payment"

export async function POST(req: NextRequest) {
  try {
    const { userId, type } = await req.json()
    if (!userId || !type) {
      return NextResponse.json({ error: "Missing userId or type" }, { status: 400 })
    }
    const order = await razorpay.orders.create({
      amount: JOINING_FEE_CHF * 100,
      currency: "CHF",
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: { userId, type, feeCHF: "1" },
    })
    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
