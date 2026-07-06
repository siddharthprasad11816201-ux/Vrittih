import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { otpStore } from "@/lib/otpStore"
import { sendMail } from "@/lib/smtp"

export async function POST(req: NextRequest) {
  try {
    const { userId, note } = await req.json()
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email:true, name:true } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const key = `otp_${userId}`
    otpStore.set(key, { otp, expiresAt: Date.now() + 10 * 60 * 1000, userId })
    await sendMail({
      to: user.email,
      subject: "Your login verification code",
      html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#F8F8FC;border-radius:12px">
            <div style="background:#fff;border-radius:12px;padding:2rem;border:1px solid rgba(0,0,0,.08)">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.5rem">
                <div style="width:36px;height:36px;background:#534AB7;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">V</div>
                <span style="font-weight:600;color:#0A0A0F">Vrittih</span>
              </div>
              <h2 style="font-size:20px;font-weight:600;color:#0A0A0F;margin:0 0 8px">Verification code</h2>
              ${note ? `<p style="font-size:14px;color:#7B7B8F;margin-bottom:1rem">${note}</p>` : ""}
              <p style="font-size:14px;color:#7B7B8F;margin-bottom:1.5rem">Use this code to complete your login. It expires in 10 minutes.</p>
              <div style="background:#EEEDF9;border:1px solid rgba(83,74,183,.2);border-radius:12px;padding:1.5rem;text-align:center;font-size:36px;font-weight:700;letter-spacing:10px;color:#534AB7">${otp}</div>
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