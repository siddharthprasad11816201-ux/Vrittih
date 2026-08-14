import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { createOtp, verifyOtp } from "@/lib/auth/otp"
import { rateLimit } from "@/lib/ratelimit/store"
import { createNotification } from "@/lib/notify"
import { sendMail } from "@/lib/smtp"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

const PURPOSE = "email_verify"

/**
 * Email verification.
 *
 * Reuses the hardened OtpChallenge machinery rather than inventing a second token system:
 * codes are cryptographically random, hashed at rest, single-use and attempt-limited, and
 * the whole thing is already swept by the maintenance cron.
 *
 * The user is taken from the SESSION, never from the request body — otherwise anyone could
 * trigger a verification mail for any address, or verify someone else's account.
 */

// POST — send a code to the signed-in user's address.
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Sign in first." }, { status: 401 })

  // Sending mail costs money and is an abuse vector; fail closed.
  const rl = await rateLimit("auth_reset", payload.userId, { scope: "verify_email", failOpen: false })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many codes requested. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true, name: true, emailVerified: true } })
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 })
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true })

  const code = await createOtp(payload.userId, PURPOSE)

  // Delivery is best-effort — a mail outage must not leave the caller with a 500 and no
  // idea whether a code was created. The code is valid either way.
  await sendMail({
    to: user.email,
    subject: "Verify your email — Vrittih",
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:28px 22px;background:#F8F8FC;border-radius:14px">
        <div style="background:#fff;border-radius:12px;padding:26px;border:1px solid rgba(0,0,0,.08)">
          <h2 style="font-size:19px;margin:0 0 8px;color:#0A0A0F">Confirm your email address</h2>
          <p style="font-size:14px;color:#3D3D4E;line-height:1.6;margin:0 0 18px">
            Enter this code to finish setting up your account. You need a verified address before you can apply to a role,
            because that is where interview invitations and decisions are sent.
          </p>
          <div style="background:#EAF1FE;border-radius:10px;padding:18px;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#2C5FCC">${code}</div>
          <p style="font-size:12px;color:#9ca3af;margin-top:14px">The code expires in 10 minutes. If you did not create a Vrittih account, ignore this email.</p>
        </div>
      </div>`,
  }).catch((e) => console.error("[VERIFY MAIL]", e?.message || e))

  return NextResponse.json({ ok: true, sentTo: user.email.replace(/(.{2}).*(@.*)/, "$1***$2") })
}

// PATCH — confirm the code.
export async function PATCH(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Sign in first." }, { status: 401 })

  const rl = await rateLimit("auth", payload.userId, { scope: "verify_email_confirm", failOpen: false })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })
  }

  let code = ""
  try { code = String((await req.json())?.code || "").trim() } catch { code = "" }
  if (!code) return NextResponse.json({ error: "Enter the code from your email." }, { status: 400 })

  const res = await verifyOtp(payload.userId, PURPOSE, code)
  if (!res.ok) {
    const msg = res.reason === "expired" ? "That code has expired. Request a new one."
      : res.reason === "too_many_attempts" ? "Too many incorrect attempts. Request a new code."
      : res.reason === "not_found" ? "No code found. Request a new one."
      : "That code is not correct."
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  await prisma.user.update({ where: { id: payload.userId }, data: { emailVerified: new Date() } })
  await createNotification({
    userId: payload.userId,
    title: "Email verified",
    body: "Your email address is confirmed — you can now apply to roles.",
    link: "/jobs",
    type: "general",
  }).catch(() => {})

  return NextResponse.json({ ok: true, verified: true })
}

// GET — where the account stands against the apply requirements.
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ verified: false, signedIn: false })
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { emailVerified: true, email: true } })
  return NextResponse.json({
    signedIn: true,
    verified: !!user?.emailVerified,
    email: user?.email?.replace(/(.{2}).*(@.*)/, "$1***$2") ?? null,
  })
}
