import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { otpStore } from "@/lib/otpStore"
import { signToken } from "@/lib/jwt"
import { setAuthCookie } from "@/lib/cookies"

export async function POST(req: NextRequest) {
  try {
    const { userId, otp, mode } = await req.json()
    if (!userId || !otp) return NextResponse.json({ error: "userId and otp required" }, { status: 400 })
    const key = `otp_${userId}`
    const stored = otpStore.get(key)
    if (!stored) return NextResponse.json({ error: "No OTP found. Please request a new one." }, { status: 400 })
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(key)
      return NextResponse.json({ error: "OTP expired. Please request a new one." }, { status: 400 })
    }
    if (stored.otp !== otp.toString().trim()) {
      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 })
    }
    otpStore.delete(key)
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
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}