import { prisma } from "@/lib/prisma"
import { computeDiscount, normalizeCode } from "@/lib/couponMath"

/* Coupons / payment waivers. ALL discount math is server-side — the client never
 * sends a price or a discount. A 100% (or "waiver") coupon drives access through a
 * dedicated no-charge activation path (app/api/payment/redeem-waiver); partial
 * coupons reduce the Razorpay order amount and are only consumed on verified
 * payment. Discount math lives in lib/couponMath (pure + unit-tested). */

export type CouponKind = "percent" | "fixed" | "waiver"
export { computeDiscount, normalizeCode }
export type { DiscountResult } from "@/lib/couponMath"

const round2 = (n: number) => Math.round(n * 100) / 100

export type ValidateArgs = { userId: string; planId?: string | null; audience?: string; amountCHF: number }
export type ValidateResult = { ok: boolean; reason?: string; coupon?: any; code?: string; kind?: string; discountCHF: number; finalCHF: number; waiver: boolean }

/** Full server-side validation: existence, active window, audience/plan scope,
 * global cap and per-user cap — then computes the discount. */
export async function validateCoupon(rawCode: string, args: ValidateArgs): Promise<ValidateResult> {
  const code = String(rawCode || "").trim().toUpperCase()
  const fail = (reason: string): ValidateResult => ({ ok: false, reason, discountCHF: 0, finalCHF: round2(args.amountCHF), waiver: false })
  if (!code) return fail("Enter a code")

  const c = await prisma.coupon.findUnique({ where: { code } }).catch(() => null)
  if (!c || !c.active) return fail("This code isn't valid")
  const now = new Date()
  if (c.startsAt && now < c.startsAt) return fail("This code isn't active yet")
  if (c.expiresAt && now > c.expiresAt) return fail("This code has expired")
  if (c.audience !== "all" && args.audience && c.audience !== args.audience) return fail("This code doesn't apply to this plan")
  if (c.planId && args.planId && c.planId !== args.planId) return fail("This code doesn't apply to this plan")
  if (c.maxRedemptions != null && c.redeemedCount >= c.maxRedemptions) return fail("This code has been fully redeemed")
  if (c.perUserLimit > 0) {
    const used = await prisma.couponRedemption.count({ where: { couponId: c.id, userId: args.userId } })
    if (used >= c.perUserLimit) return fail("You've already used this code")
  }

  const d = computeDiscount(c.kind, c.value, args.amountCHF)
  return { ok: true, coupon: c, code, kind: c.kind, ...d }
}

/** Atomically consume one redemption. The @@unique([couponId,userId]) constraint
 * makes the row insert fail on a second attempt by the same user (per-user cap),
 * and the transaction re-checks the global cap before incrementing. Throws on
 * exhaustion/duplicate so callers never grant access twice. */
export async function recordRedemption(
  couponId: string,
  userId: string,
  data: { planId?: string | null; amountBeforeCHF: number; amountAfterCHF: number; waiver: boolean; orderId?: string | null },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const c = await tx.coupon.findUnique({ where: { id: couponId } })
    if (!c || !c.active) throw new Error("coupon_inactive")
    if (c.maxRedemptions != null && c.redeemedCount >= c.maxRedemptions) throw new Error("coupon_exhausted")
    await tx.couponRedemption.create({
      data: {
        couponId, userId, planId: data.planId ?? null,
        amountBeforeCHF: data.amountBeforeCHF, amountAfterCHF: data.amountAfterCHF,
        waiver: data.waiver, orderId: data.orderId ?? null,
      },
    })
    await tx.coupon.update({ where: { id: couponId }, data: { redeemedCount: { increment: 1 } } })
  })
}
