import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { retrieveSession } from "@/lib/stripe"

export const dynamic = "force-dynamic"

// Called when Stripe redirects the user back. Verifies the session is paid and
// belongs to this user, then grants access. The webhook is the authoritative path;
// this makes the redirect flow work too (and locally, without a public webhook URL).
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 })

    const session = await retrieveSession(sessionId)
    if (session.payment_status !== "paid") return NextResponse.json({ paid: false, status: session.payment_status })
    if (session.client_reference_id && session.client_reference_id !== payload.userId) {
      return NextResponse.json({ error: "Session does not belong to this account" }, { status: 403 })
    }
    await prisma.user.update({ where: { id: payload.userId }, data: { paid: true, paidAt: new Date(), paymentId: sessionId } })
    return NextResponse.json({ paid: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Confirmation failed" }, { status: 500 })
  }
}
