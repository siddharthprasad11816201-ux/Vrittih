import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/hash"
import { signToken } from "@/lib/jwt"
import { setAuthCookie } from "@/lib/cookies"
import { registerSchema } from "@/lib/validate"
import { checkRateLimit } from "@/lib/ratelimit"
import { isTrue } from "@/lib/settings"

export async function POST(req: NextRequest) {
  try {
    if (!(await isTrue("signupsEnabled"))) {
      return NextResponse.json(
        { error: "New sign-ups are currently disabled. Please check back later." },
        { status: 403 }
      )
    }

    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const limit = checkRateLimit("register:" + ip)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 }
      )
    }

    const body = await req.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, email, password, role } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      )
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        profile: { create: {} },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        paid: true,
        createdAt: true,
      },
    })

    await prisma.loginAttempt.create({
      data: {
        userId: user.id,
        email,
        ip,
        success: true,
      },
    })

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      paid: user.paid,
    })

    await setAuthCookie(token)

    return NextResponse.json({ success: true, user }, { status: 201 })
  } catch (err: any) {
    console.error("[REGISTER]", err)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
