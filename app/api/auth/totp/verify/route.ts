import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTOTP } from "@/lib/totp"
import { signToken } from "@/lib/jwt"
import { setAuthCookie } from "@/lib/cookies"
import { recordLoginAttempt } from "@/lib/account/loginHistory"
import { verifyChallenge, challengeFrom } from "@/lib/auth/challenge"
import { rateLimit } from "@/lib/ratelimit/store"

export const dynamic = "force-dynamic"

// Login step 2 for authenticator users: verify the TOTP code, issue session.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code } = body
    if (!code) return NextResponse.json({ error: "code required" }, { status: 400 })
    // Previously a TOTP code alone minted a 7-day session with no proof the password step
    // ever happened. The user now comes from the signed post-password challenge.
    const chal = verifyChallenge(challengeFrom(body, req), "2fa_totp")
    if (!chal.valid) return NextResponse.json({ error: "Sign in with your password first." }, { status: 401 })
    const userId = chal.userId as string

    const rl = await rateLimit("auth", userId, { scope: "totp", failOpen: false })
    if (!rl.allowed) return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, paid: true, banned: true, twoFactorEnabled: true, twoFactorSecret: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (user.banned) return NextResponse.json({ error: "Account suspended" }, { status: 403 })

    const secret = user.twoFactorSecret?.startsWith("totp:") ? user.twoFactorSecret.slice(5) : null
    if (!user.twoFactorEnabled || !secret) {
      return NextResponse.json({ error: "Authenticator 2FA is not enabled for this account" }, { status: 400 })
    }

    if (!verifyTOTP(secret, String(code))) {
      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 })
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role, paid: user.paid })
    const res = NextResponse.json({ success: true, userId: user.id })
    await setAuthCookie(token)
    await recordLoginAttempt(user.id, user.email, req, true)
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
