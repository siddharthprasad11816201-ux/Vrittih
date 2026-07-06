import { NextResponse } from "next/server"
import { razorpay } from "@/lib/razorpay"

export async function POST() {
  try {
    const order = await razorpay.orders.create({
      amount: 100,
      currency: "CHF",
      receipt: "test_" + Date.now(),
      notes: { test: "true" },
    })
    return NextResponse.json({ success: true, message: "Razorpay connected and working", testOrderId: order.id })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Failed: " + err.message }, { status: 500 })
  }
}
