import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyWebhook } from "@/lib/stripe"

export const dynamic = "force-dynamic"

// Authoritative payment confirmation. Configure this URL in the Stripe dashboard
// (Developers → Webhooks) for event `checkout.session.completed`.
export async function POST(req: NextRequest) {
  const payload = await req.text() // raw body required for signature check
  const event = verifyWebhook(payload, req.headers.get("stripe-signature"))
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 })

  if (event.type === "checkout.session.completed") {
    const session = event.data.object
    const userId = session.client_reference_id || session.metadata?.userId
    if (userId && session.payment_status === "paid") {
      await prisma.user.update({ where: { id: userId }, data: { paid: true, paidAt: new Date(), paymentId: session.id } }).catch(() => {})
    }
  }
  return NextResponse.json({ received: true })
}
