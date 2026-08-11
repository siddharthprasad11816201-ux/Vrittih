import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createOtp } from "@/lib/auth/otp"
import { verifyChallenge, challengeFrom } from "@/lib/auth/challenge"
import { rateLimit } from "@/lib/ratelimit/store"
import { sendMail } from "@/lib/smtp"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { note } = body
    // Was: unauthenticated, arbitrary userId -> anyone could mail-bomb any account with
    // OTPs. The user is now taken from a signed post-password challenge, never the body.
    const chal = verifyChallenge(challengeFrom(body, req), ["2fa_email", "face"])
    if (!chal.valid) return NextResponse.json({ error: "Sign in with your password first." }, { status: 401 })
    const userId = chal.userId as string

    const rl = await rateLimit("auth_reset", userId, { failOpen: false })
    if (!rl.allowed) return NextResponse.json({ error: "Too many codes requested. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email:true, name:true } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    // Cryptographically secure, hashed at rest, attempt-limited (lib/auth/otp).
    const otp = await createOtp(userId, "login")
    await sendMail({
      to: user.email,
      subject: "Your login verification code",
      html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#F8F8FC;border-radius:12px">
            <div style="background:#fff;border-radius:12px;padding:2rem;border:1px solid rgba(0,0,0,.08)">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.5rem">
                <div style="width:36px;height:36px;background:#6495ED;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">V</div>
                <span style="font-weight:600;color:#0A0A0F">Vrittih</span>
              </div>
              <h2 style="font-size:20px;font-weight:600;color:#0A0A0F;margin:0 0 8px">Verification code</h2>
              ${note ? `<p style="font-size:14px;color:#7B7B8F;margin-bottom:1rem">${note}</p>` : ""}
              <p style="font-size:14px;color:#7B7B8F;margin-bottom:1.5rem">Use this code to complete your login. It expires in 10 minutes.</p>
              <div style="background:#EAF1FE;border:1px solid rgba(15,110,86,.2);border-radius:12px;padding:1.5rem;text-align:center;font-size:36px;font-weight:700;letter-spacing:10px;color:#6495ED">${otp}</div>
              <p style="font-size:12px;color:#9ca3af;margin-top:1rem;text-align:center">Do not share this code with anyone.</p>
            </div>
          </div>
        `,
    }).catch((e) => console.error("[OTP mail]", e.message))
    return NextResponse.json({ success: true, email: user.email.replace(/(.{2}).*(@.*)/, "$1***$2") })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}