import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { TRIAL_DAYS } from "@/lib/trial"

export const dynamic = "force-dynamic"

/* Start the 7-day Basic trial — free, no payment mandate required. Idempotent:
 * a user who already paid, is on a plan, or has used their trial can't restart it.
 * Unlocks Basic features + up to 10 applications for the window. */
export async function POST(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  if (!p) return NextResponse.json({ error: "Please sign in." }, { status: 401 })

  const u = await prisma.user.findUnique({ where: { id: p.userId }, select: { paid: true, plan: true, trialStartedAt: true } })
  if (!u) return NextResponse.json({ error: "Account not found." }, { status: 404 })
  if (u.paid || (u.plan && u.plan !== "free")) return NextResponse.json({ ok: true, already: true, message: "You already have full access." })
  if (u.trialStartedAt) return NextResponse.json({ error: "You've already used your free trial.", used: true }, { status: 409 })

  const now = new Date()
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86400000)
  await prisma.user.update({ where: { id: p.userId }, data: { trialStartedAt: now, trialEndsAt } })
  return NextResponse.json({ ok: true, trialEndsAt })
}
