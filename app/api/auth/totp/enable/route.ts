import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { verifyTOTP } from "@/lib/totp"

export const dynamic = "force-dynamic"

// Confirm enrollment: the user proves their authenticator produces valid codes.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const { code } = await req.json()
    if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 })

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { twoFactorSecret: true },
    })
    const secret = user?.twoFactorSecret?.startsWith("totp:") ? user.twoFactorSecret.slice(5) : null
    if (!secret) return NextResponse.json({ error: "No pending authenticator setup. Start setup first." }, { status: 400 })

    if (!verifyTOTP(secret, String(code))) {
      return NextResponse.json({ error: "Incorrect code. Check your authenticator app and try again." }, { status: 400 })
    }

    await prisma.user.update({ where: { id: payload.userId }, data: { twoFactorEnabled: true } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
