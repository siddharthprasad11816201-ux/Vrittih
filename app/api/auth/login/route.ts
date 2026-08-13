import { NextRequest, NextResponse } from "next/server"
import { isTotp } from "@/lib/crypto/storedSecret"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/hash"
import { signToken } from "@/lib/jwt"
import { setAuthCookie } from "@/lib/cookies"
import { track } from "@/lib/analytics"
import { rateLimit, clearRateLimit } from "@/lib/ratelimit/store"
import { recordLoginAttempt } from "@/lib/account/loginHistory"
import { issueChallenge } from "@/lib/auth/challenge"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 })

    // Throttle credential-stuffing per ACCOUNT (5 attempts / 15 min per email).
    // Deliberately NOT per-IP: at scale, many legitimate users share one IP
    // (office/mobile NAT), so IP throttling would lock them out.
    const em = email.toLowerCase().trim()
    // failOpen:false — if the counter store is down we must NOT hand out unlimited
    // credential attempts. Auth is the one place where failing closed is correct.
    const rl = await rateLimit("auth", em, { failOpen: false })
    if (!rl.allowed) {
      const mins = Math.ceil(rl.retryAfterSeconds / 60)
      return NextResponse.json({ error: `Too many attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.` }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })
    }
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id:true,email:true,name:true,password:true,role:true,paid:true,banned:true,faceVector:true,twoFactorEnabled:true,twoFactorSecret:true }
    })
    if (!user) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    if (user.banned) return NextResponse.json({ error: "Account suspended. Contact support." }, { status: 403 })
    const valid = await verifyPassword(password, user.password)
    if (!valid) {
      await recordLoginAttempt(user.id, user.email, req, false)
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }
    // Correct password — clear the throttle so genuine users aren't locked out.
    await clearRateLimit("auth", em)

    // Step 2 endpoints require this challenge, which is ONLY issued once the password has
    // verified. Previously they accepted a bare userId, so the second factor was the only
    // factor and the password could be skipped entirely.
    if (user.faceVector) {
      return NextResponse.json({ requiresFaceVerify: true, userId: user.id, challenge: issueChallenge(user.id, "face") })
    }

    // If 2FA enabled — require a second factor.
    // "totp:" secrets use the in-house authenticator flow; otherwise email OTP.
    if (user.twoFactorEnabled) {
      // Only the discriminator is inspected — the secret is never decrypted here.
      const method = isTotp(user.twoFactorSecret) ? "totp" : "email"
      return NextResponse.json({
        requires2FA: true, method, userId: user.id,
        challenge: issueChallenge(user.id, method === "totp" ? "2fa_totp" : "2fa_email"),
      })
    }

    // Direct login
    const token = signToken({ userId: user.id, email: user.email, role: user.role, paid: user.paid })
    const res = NextResponse.json({ success: true, user: { id:user.id,name:user.name,role:user.role,paid:user.paid } })
    await setAuthCookie(token)
    await recordLoginAttempt(user.id, user.email, req, true)
    await track("signin.succeeded", { method: "password", role: user.role }, user.id)
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}