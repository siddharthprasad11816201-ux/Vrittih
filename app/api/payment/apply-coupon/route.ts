import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { validateCoupon } from "@/lib/coupon"
import { getEffectivePlan } from "@/lib/pricing"
import { JOINING_FEE_CHF } from "@/lib/payment"

export const dynamic = "force-dynamic"

/* Server-side coupon preview. Prices the plan from the live catalogue (never the
 * client) and returns the discount so checkout can show it. This is preview only:
 * nothing is consumed here — redemption happens on verified payment or via the
 * waiver path. */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("er_token")?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return NextResponse.json({ ok: false, reason: "Please sign in to use a code." }, { status: 401 })

  const { code, planId, type = "jobseeker" } = await req.json().catch(() => ({}))
  const plan = planId ? await getEffectivePlan(planId) : null
  if (planId && !plan) return NextResponse.json({ ok: false, reason: "Unknown plan." }, { status: 400 })
  const amountCHF = plan ? plan.priceCHF : JOINING_FEE_CHF
  const audience = type === "employer" ? "employer" : "individual"

  const r = await validateCoupon(String(code || ""), { userId: payload.userId, planId: planId || null, audience, amountCHF })
  return NextResponse.json({
    ok: r.ok, reason: r.reason, kind: r.kind,
    amountCHF, discountCHF: r.discountCHF, finalCHF: r.finalCHF, waiver: r.waiver,
    code: r.code,
  })
}
