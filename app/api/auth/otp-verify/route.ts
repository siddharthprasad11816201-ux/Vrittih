import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyOtp } from "@/lib/auth/otp"
import { verifyChallenge, challengeFrom } from "@/lib/auth/challenge"
import { rateLimit } from "@/lib/ratelimit/store"
import { signToken } from "@/lib/jwt"
import { setAuthCookie } from "@/lib/cookies"
import { recordLoginAttempt } from "@/lib/account/loginHistory"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { otp, mode } = body
    if (!otp) return NextResponse.json({ error: "otp required" }, { status: 400 })
    // The user comes from the signed post-password challenge, NOT the request body.
    const chal = verifyChallenge(challengeFrom(body, req), ["2fa_email", "face"])
    if (!chal.valid) return NextResponse.json({ error: "Sign in with your password first." }, { status: 401 })
    const userId = chal.userId as string

    const rl = await rateLimit("auth", userId, { scope: "otp", failOpen: false })
    if (!rl.allowed) return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

    // Attempt-limited + single-use + constant-time (lib/auth/otp).
    const res0 = await verifyOtp(userId, "login", String(otp))
    if (!res0.ok) {
      const msg = res0.reason === "expired" ? "Code expired. Please request a new one."
        : res0.reason === "too_many_attempts" ? "Too many incorrect attempts. Please request a new code."
        : res0.reason === "not_found" ? "No code found. Please request a new one."
        : "Incorrect code. Please try again."
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id:true, email:true, role:true, paid:true, banned:true }
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (user.banned) return NextResponse.json({ error: "Account suspended" }, { status: 403 })
    const token = signToken({ userId: user.id, email: user.email, role: user.role, paid: user.paid })
    const res = NextResponse.json({
      success: true,
      requiresReenroll: mode === "injury",
      userId: user.id
    })
    await setAuthCookie(token)
    await recordLoginAttempt(user.id, user.email, req, true)
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}