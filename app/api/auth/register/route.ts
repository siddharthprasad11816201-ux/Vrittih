import { NextRequest, NextResponse } from "next/server"
import { createOtp } from "@/lib/auth/otp"
import { sendMail } from "@/lib/smtp"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/hash"
import { signToken } from "@/lib/jwt"
import { setAuthCookie } from "@/lib/cookies"
import { registerSchema } from "@/lib/validate"
import { rateLimit, clientIp } from "@/lib/ratelimit/store"
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
    const limit = await rateLimit("register", ip)
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

    // Send the verification code immediately. Registration still signs the user in — they
    // can browse and build their profile straight away — but APPLYING requires the address
    // to be proven (lib/account/registration), so the sooner this lands the better.
    // Best-effort: a mail outage must not fail the registration itself.
    try {
      const code = await createOtp(user.id, "email_verify")
      await sendMail({
        to: user.email,
        subject: "Verify your email — Vrittih",
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:28px 22px;background:#F8F8FC;border-radius:14px">
            <div style="background:#fff;border-radius:12px;padding:26px;border:1px solid rgba(0,0,0,.08)">
              <h2 style="font-size:19px;margin:0 0 8px;color:#0A0A0F">Welcome to Vrittih</h2>
              <p style="font-size:14px;color:#3D3D4E;line-height:1.6;margin:0 0 18px">
                Enter this code to confirm your email. You will need a verified address before you can apply to a role —
                it is where interview invitations and decisions are sent.
              </p>
              <div style="background:#EAF1FE;border-radius:10px;padding:18px;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#2C5FCC">${code}</div>
              <p style="font-size:12px;color:#9ca3af;margin-top:14px">The code expires in 10 minutes.</p>
            </div>
          </div>`,
      })
    } catch (e: any) {
      console.error("[REGISTER VERIFY MAIL]", e?.message || e)
    }

    return NextResponse.json({ success: true, user, emailVerificationSent: true }, { status: 201 })
  } catch (err: any) {
    console.error("[REGISTER]", err)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
