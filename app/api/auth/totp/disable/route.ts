import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { verifyTOTP } from "@/lib/totp"

export const dynamic = "force-dynamic"

// Disable authenticator 2FA — requires a currently-valid code to prevent
// an attacker with a stolen session from silently weakening the account.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const { code } = await req.json()
    if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 })

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    })
    const secret = user?.twoFactorSecret?.startsWith("totp:") ? user.twoFactorSecret.slice(5) : null
    if (!secret || !user?.twoFactorEnabled) {
      return NextResponse.json({ error: "Authenticator 2FA is not enabled" }, { status: 400 })
    }

    if (!verifyTOTP(secret, String(code))) {
      return NextResponse.json({ error: "Incorrect code" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: payload.userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
