import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { validateCoupon } from "@/lib/coupon"
import { getEffectivePlan } from "@/lib/pricing"
import { JOINING_FEE_CHF } from "@/lib/payment"

export const dynamic = "force-dynamic"

/* 100% coupon → grant access WITHOUT a Razorpay charge. The discount is
 * recomputed server-side; access is granted only if the coupon genuinely brings
 * the total to 0. Consume + activate happen in ONE transaction (the
 * @@unique([couponId,userId]) blocks double-grants; the tx re-checks the global
 * cap), mirroring app/api/payment/verify activation minus the signature step.
 * Role is intentionally NOT changed here — identity stays as chosen at signup. */
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 })

    const { code, planId, type = "jobseeker" } = await req.json().catch(() => ({}))
    const plan = planId ? await getEffectivePlan(planId) : null
    if (planId && !plan) return NextResponse.json({ error: "Unknown plan." }, { status: 400 })
    const amountCHF = plan ? plan.priceCHF : JOINING_FEE_CHF
    // Audience from the actual plan, not the client `type` — otherwise an
    // individual-scoped waiver could free an employer plan (and vice-versa).
    const audience = plan ? plan.audience : "individual"

    const v = await validateCoupon(String(code || ""), { userId: payload.userId, planId: planId || null, audience, amountCHF })
    if (!v.ok || !v.coupon) return NextResponse.json({ error: v.reason || "This code isn't valid." }, { status: 400 })
    if (!v.waiver || v.finalCHF > 0) {
      return NextResponse.json({ error: "This code only reduces the price — please complete payment for the balance." }, { status: 400 })
    }

    try {
      await prisma.$transaction(async (tx) => {
        const c = await tx.coupon.findUnique({ where: { id: v.coupon.id } })
        if (!c || !c.active) throw new Error("coupon_inactive")
        if (c.maxRedemptions != null && c.redeemedCount >= c.maxRedemptions) throw new Error("coupon_exhausted")
        // Per-user cap: the @@unique([couponId,userId]) makes this create throw on a
        // second attempt by the same user.
        await tx.couponRedemption.create({
          data: { couponId: c.id, userId: payload.userId, planId: planId || null, amountBeforeCHF: amountCHF, amountAfterCHF: 0, waiver: true },
        })
        // Global cap: atomic compare-and-swap. With a cap, only increment the row
        // whose redeemedCount still equals what we read; a concurrent grant makes
        // this match 0 rows (row-locked re-evaluation), so the cap can't be overshot.
        if (c.maxRedemptions != null) {
          const upd = await tx.coupon.updateMany({ where: { id: c.id, redeemedCount: c.redeemedCount }, data: { redeemedCount: { increment: 1 } } })
          if (upd.count === 0) throw new Error("coupon_exhausted")
        } else {
          await tx.coupon.update({ where: { id: c.id }, data: { redeemedCount: { increment: 1 } } })
        }
        const data: any = { paid: true, paidAt: new Date(), paymentId: `waiver_${c.code}_${payload.userId}` }
        if (planId) { const renews = new Date(); renews.setMonth(renews.getMonth() + 1); data.plan = planId; data.planRenewsAt = renews }
        await tx.user.update({ where: { id: payload.userId }, data })
      })
    } catch (e: any) {
      const msg = String(e?.message || "")
      if (msg.includes("Unique constraint") || msg.includes("coupon_exhausted") || msg.includes("coupon_inactive")) {
        return NextResponse.json({ error: "This code can no longer be redeemed." }, { status: 409 })
      }
      throw e
    }

    return NextResponse.json({ success: true, activated: true, plan: planId || null, waiver: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not apply the waiver." }, { status: 500 })
  }
}
