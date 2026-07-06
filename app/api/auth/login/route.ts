import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/hash"
import { signToken } from "@/lib/jwt"
import { setAuthCookie } from "@/lib/cookies"
import { track } from "@/lib/analytics"
import { checkRateLimit, resetRateLimit } from "@/lib/ratelimit"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 })

    // Throttle credential-stuffing per ACCOUNT (5 attempts / 15 min per email).
    // Deliberately NOT per-IP: at scale, many legitimate users share one IP
    // (office/mobile NAT), so IP throttling would lock them out.
    const em = email.toLowerCase().trim()
    const rl = checkRateLimit(`login:email:${em}`)
    if (!rl.allowed) {
      const mins = Math.ceil((rl.resetAt - Date.now()) / 60000)
      return NextResponse.json({ error: `Too many attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.` }, { status: 429 })
    }
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id:true,email:true,name:true,password:true,role:true,paid:true,banned:true,faceVector:true,twoFactorEnabled:true,twoFactorSecret:true }
    })
    if (!user) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    if (user.banned) return NextResponse.json({ error: "Account suspended. Contact support." }, { status: 403 })
    const valid = await verifyPassword(password, user.password)
    if (!valid) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    // Correct password — clear the throttle so genuine users aren't locked out.
    resetRateLimit(`login:email:${em}`)

    // If face vector enrolled — require face verification
    if (user.faceVector) {
      return NextResponse.json({ requiresFaceVerify: true, userId: user.id })
    }

    // If 2FA enabled — require a second factor.
    // "totp:" secrets use the in-house authenticator flow; otherwise email OTP.
    if (user.twoFactorEnabled) {
      const method = user.twoFactorSecret?.startsWith("totp:") ? "totp" : "email"
      return NextResponse.json({ requires2FA: true, method, userId: user.id })
    }

    // Direct login
    const token = signToken({ userId: user.id, email: user.email, role: user.role, paid: user.paid })
    const res = NextResponse.json({ success: true, user: { id:user.id,name:user.name,role:user.role,paid:user.paid } })
    await setAuthCookie(token)
    await track("signin.succeeded", { method: "password", role: user.role }, user.id)
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}