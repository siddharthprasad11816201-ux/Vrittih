import { NextResponse } from "next/server"
import { getAuthCookie } from "@/lib/cookies"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const token = await getAuthCookie()
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        paid: true,
        avatar: true,
        headline: true,
        location: true,
        idVerified: true,
        twoFactorEnabled: true,
        banned: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.banned) {
      return NextResponse.json({ error: "This account has been suspended." }, { status: 403 })
    }

    return NextResponse.json({ user })
  } catch (err: any) {
    console.error("[ME]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
