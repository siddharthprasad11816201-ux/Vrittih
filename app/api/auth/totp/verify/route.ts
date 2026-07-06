import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTOTP } from "@/lib/totp"
import { signToken } from "@/lib/jwt"
import { setAuthCookie } from "@/lib/cookies"

export const dynamic = "force-dynamic"

// Login step 2 for authenticator users: verify the TOTP code, issue session.
export async function POST(req: NextRequest) {
  try {
    const { userId, code } = await req.json()
    if (!userId || !code) return NextResponse.json({ error: "userId and code required" }, { status: 400 })

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
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
