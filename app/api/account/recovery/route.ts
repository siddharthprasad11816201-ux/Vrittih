import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { hashPassword } from "@/lib/hash"
import { rateLimit } from "@/lib/ratelimit/store"
import {
  SECURITY_QUESTIONS, REQUIRED_ANSWERS, validateSetup, parseBirthDate, promptFor,
} from "@/lib/auth/recovery"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

/**
 * Set up account recovery — the signed-in half.
 *
 * With no email channel, this is the ONLY way back into an account, so the user configures
 * it here while they are already authenticated. Answers are bcrypt-hashed like passwords;
 * this endpoint can write them but can never read them back.
 */
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const [user, answers] = await Promise.all([
    prisma.user.findUnique({ where: { id: payload.userId }, select: { dateOfBirth: true } }),
    (prisma as any).securityAnswer.findMany({ where: { userId: payload.userId }, select: { questionKey: true, updatedAt: true } }),
  ])

  const configured = answers.length >= REQUIRED_ANSWERS && !!user?.dateOfBirth
  return NextResponse.json({
    configured,
    requiredAnswers: REQUIRED_ANSWERS,
    hasDateOfBirth: !!user?.dateOfBirth,
    // The chosen questions are shown; the ANSWERS are hashed and never returned.
    chosen: answers.map((a: any) => ({ questionKey: a.questionKey, prompt: promptFor(a.questionKey), updatedAt: a.updatedAt })),
    questions: SECURITY_QUESTIONS,
    note: configured
      ? "Recovery is set up. Keep your answers private — they can reset your password."
      : `Choose ${REQUIRED_ANSWERS} questions and add your date of birth. Without this there is no way to recover a forgotten password.`,
  })
}

export async function PUT(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const rl = await rateLimit("write", payload.userId, { scope: "recovery_setup" })
  if (!rl.allowed) return NextResponse.json({ error: "Too many changes. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

  try {
    const body = await req.json()

    const dob = parseBirthDate(String(body?.dateOfBirth || ""))
    if (!dob) return NextResponse.json({ error: "Enter a valid date of birth as YYYY-MM-DD." }, { status: 400 })

    const check = validateSetup(Array.isArray(body?.answers) ? body.answers : [])
    if (!check.ok) {
      return NextResponse.json({
        error: check.accepted.length < REQUIRED_ANSWERS
          ? `Answer at least ${REQUIRED_ANSWERS} different questions.`
          : "Some answers could not be accepted.",
        problems: check.errors,
      }, { status: 400 })
    }

    // Replace the whole set atomically — a half-written set would leave recovery in a
    // state the user does not know about, which is worse than not configured.
    const hashed = await Promise.all(
      check.accepted.map(async (a) => ({
        userId: payload.userId, questionKey: a.questionKey, answerHash: await hashPassword(a.normalized),
      })),
    )
    await prisma.$transaction([
      (prisma as any).securityAnswer.deleteMany({ where: { userId: payload.userId } }),
      (prisma as any).securityAnswer.createMany({ data: hashed }),
      prisma.user.update({
        where: { id: payload.userId },
        // Configuring recovery clears any existing lockout.
        data: { dateOfBirth: dob, recoveryAttempts: 0, recoveryLockedAt: null },
      }),
    ])

    return NextResponse.json({ ok: true, configured: true, answers: hashed.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
