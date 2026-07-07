import { NextResponse } from "next/server"
import { getRazorpay, razorpayConfigured } from "@/lib/razorpay"

// Admin gateway health check.
export async function POST() {
  if (!razorpayConfigured()) {
    return NextResponse.json({ success: false, message: "Razorpay not configured (add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)." }, { status: 503 })
  }
  try {
    const order = await getRazorpay().orders.create({
      amount: 100, currency: "INR", receipt: "test_" + Date.now(), notes: { test: "true" },
    })
    return NextResponse.json({ success: true, message: "Razorpay connected and working", testOrderId: order.id })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Failed: " + err.message }, { status: 500 })
  }
}
