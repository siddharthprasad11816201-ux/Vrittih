import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { generateTOTPSecret, buildOtpauthURI, formatSecret } from "@/lib/totp"

export const dynamic = "force-dynamic"

// Begin authenticator enrollment: generate a secret and store it pending.
// 2FA is NOT enabled until the user proves possession via /totp/enable.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const secret = generateTOTPSecret()
    await prisma.user.update({
      where: { id: payload.userId },
      data: { twoFactorSecret: `totp:${secret}`, twoFactorEnabled: false },
    })

    return NextResponse.json({
      success: true,
      secret,
      secretFormatted: formatSecret(secret),
      uri: buildOtpauthURI(secret, payload.email),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
