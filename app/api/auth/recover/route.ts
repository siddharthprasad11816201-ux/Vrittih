import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword } from "@/lib/hash"
import { rateLimit, clientIp, clearRateLimit } from "@/lib/ratelimit/store"
import { issueChallenge, verifyChallenge, challengeFrom } from "@/lib/auth/challenge"
import { logAction } from "@/lib/admin"
import {
  normalizeAnswer, parseBirthDate, sameCalendarDay, promptFor, decideRecovery,
  MAX_RECOVERY_ATTEMPTS, REQUIRED_ANSWERS, GENERIC_FAILURE,
} from "@/lib/auth/recovery"

export const dynamic = "force-dynamic"

/**
 * Password recovery without email: date of birth + security answers.
 *
 * Three steps, deliberately:
 *   POST   { email, dateOfBirth }                  -> the user's questions, IF the DOB matches
 *   PATCH  { email, dateOfBirth, answers[] }       -> a short-lived reset challenge
 *   PUT    { challenge, newPassword }              -> the password is changed
 *
 * The date of birth gates step one so the questions are not handed to someone who only
 * knows an email address — which also blunts account enumeration. Every failure returns the
 * SAME message and the same status, so the endpoint cannot be used as an oracle for which
 * addresses are registered or what somebody's birthday is.
 */

const fail = () => NextResponse.json({ error: GENERIC_FAILURE }, { status: 400 })

async function findSubject(email: string) {
  const e = String(email || "").toLowerCase().trim()
  if (!e) return null
  return prisma.user.findUnique({
    where: { email: e },
    select: {
      id: true, email: true, banned: true, dateOfBirth: true,
      recoveryAttempts: true, recoveryLockedAt: true,
      securityAnswers: { select: { questionKey: true, answerHash: true } },
    },
  }).catch(() => null)
}

/** Step 1 — prove the date of birth, receive the questions. */
export async function POST(req: NextRequest) {
  // Rate limited by IP and fails CLOSED: this is an unauthenticated guessing surface.
  const rl = await rateLimit("auth_reset", clientIp(req), { scope: "recover_start", failOpen: false })
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

  try {
    const { email, dateOfBirth } = await req.json()
    const dob = parseBirthDate(String(dateOfBirth || ""))
    if (!dob) return fail()

    const user = await findSubject(email)
    // Identical response for "no such account", "wrong DOB", "no recovery set up" and
    // "banned" — anything else leaks.
    if (!user || user.banned || !user.dateOfBirth) return fail()
    if (!sameCalendarDay(user.dateOfBirth, dob)) return fail()
    if (user.securityAnswers.length < REQUIRED_ANSWERS) return fail()
    if (user.recoveryLockedAt) return fail()

    return NextResponse.json({
      ok: true,
      questions: user.securityAnswers.map((a) => ({ questionKey: a.questionKey, prompt: promptFor(a.questionKey) })),
      attemptsRemaining: Math.max(0, MAX_RECOVERY_ATTEMPTS - user.recoveryAttempts),
    })
  } catch { return fail() }
}

/** Step 2 — answer the questions, receive a short-lived reset challenge. */
export async function PATCH(req: NextRequest) {
  const rl = await rateLimit("auth", clientIp(req), { scope: "recover_verify", failOpen: false })
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

  try {
    const { email, dateOfBirth, answers } = await req.json()
    const dob = parseBirthDate(String(dateOfBirth || ""))
    if (!dob || !Array.isArray(answers)) return fail()

    const user = await findSubject(email)
    if (!user || user.banned || !user.dateOfBirth) return fail()
    if (!sameCalendarDay(user.dateOfBirth, dob)) return fail()
    if (user.recoveryLockedAt) return fail()

    // Count the attempt BEFORE comparing, so an aborted request cannot yield a free guess.
    const bumped = await prisma.user.update({
      where: { id: user.id },
      data: { recoveryAttempts: { increment: 1 } },
      select: { recoveryAttempts: true },
    })

    const supplied = new Map<string, string>()
    for (const a of answers) {
      if (a?.questionKey && typeof a?.answer === "string") supplied.set(String(a.questionKey), normalizeAnswer(a.answer))
    }

    // EVERY configured answer must be correct — partial credit would make guessing cheap.
    let correct = 0
    for (const stored of user.securityAnswers) {
      const given = supplied.get(stored.questionKey)
      if (!given) continue
      if (await verifyPassword(given, stored.answerHash)) correct++
    }

    const verdict = decideRecovery({
      configuredCount: user.securityAnswers.length,
      correctCount: correct,
      attemptsUsed: bumped.recoveryAttempts - 1,
    })

    if (!verdict.ok) {
      // Lock the flow once the budget is spent. Low-entropy answers make an unlimited
      // guessing surface genuinely dangerous.
      if (bumped.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
        await prisma.user.update({ where: { id: user.id }, data: { recoveryLockedAt: new Date() } })
        await logAction(user.id, "account.recovery.locked", { attempts: bumped.recoveryAttempts }, req).catch(() => {})
      }
      return fail()
    }

    await prisma.user.update({ where: { id: user.id }, data: { recoveryAttempts: 0 } })
    await logAction(user.id, "account.recovery.verified", {}, req).catch(() => {})

    // A purpose-bound, short-lived challenge — NOT a session. It can only reset a password.
    return NextResponse.json({ ok: true, challenge: issueChallenge(user.id, "password_reset") })
  } catch { return fail() }
}

/** Step 3 — set the new password. */
export async function PUT(req: NextRequest) {
  const rl = await rateLimit("auth", clientIp(req), { scope: "recover_reset", failOpen: false })
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

  try {
    const body = await req.json()
    const chal = verifyChallenge(challengeFrom(body, req), "password_reset")
    if (!chal.valid) return NextResponse.json({ error: "That reset link has expired. Start again." }, { status: 401 })

    const newPassword = String(body?.newPassword || "")
    if (newPassword.length < 8) return NextResponse.json({ error: "Choose a password of at least 8 characters." }, { status: 400 })

    await prisma.user.update({
      where: { id: chal.userId as string },
      data: { password: await hashPassword(newPassword), recoveryAttempts: 0, recoveryLockedAt: null },
    })
    await logAction(chal.userId as string, "account.password.reset", { via: "security_questions" }, req).catch(() => {})
    await clearRateLimit("auth", chal.userId as string, "otp").catch(() => {})

    // HONEST LIMITATION: sessions are stateless JWTs, so any session opened before this
    // reset stays valid until it expires. Revoking them needs a token version or a session
    // table; until then, say so rather than implying the account is fully secured.
    return NextResponse.json({
      ok: true,
      note: "Password changed. Sessions already signed in elsewhere remain active until they expire.",
    })
  } catch (err: any) {
    return NextResponse.json({ error: "Could not reset the password." }, { status: 500 })
  }
}
