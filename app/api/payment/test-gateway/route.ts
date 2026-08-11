import { NextRequest, NextResponse } from "next/server"
import { getRazorpay, razorpayConfigured } from "@/lib/razorpay"
import { requireSuperAdmin, logAction } from "@/lib/admin"

// Admin gateway health check. This creates a REAL order against live payment credentials,
// so it was an unauthenticated money-touching endpoint — now super-admin only and audited.
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  if (!razorpayConfigured()) {
    return NextResponse.json({ success: false, message: "Razorpay not configured (add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)." }, { status: 503 })
  }
  try {
    const order = await getRazorpay().orders.create({
      amount: 100, currency: "INR", receipt: "test_" + Date.now(), notes: { test: "true" },
    })
    await logAction(admin.userId, "payment.gateway.test", { orderId: order.id }, req)
    return NextResponse.json({ success: true, message: "Razorpay connected and working", testOrderId: order.id })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Failed: " + err.message }, { status: 500 })
  }
}
