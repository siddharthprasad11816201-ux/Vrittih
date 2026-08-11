/**
 * Email OTP — cryptographically random, hashed at rest, attempt-limited, DB-backed.
 *
 * Replaces lib/otpStore (an in-process Map) which had three defects:
 *   1. `Math.floor(100000 + Math.random()*900000)` — Math.random is NOT cryptographically
 *      secure, so codes were predictable from observed output.
 *   2. NO attempt counter — a 6-digit code is only 900k possibilities and the verify
 *      endpoint was unlimited and unthrottled, i.e. account takeover by brute force.
 *   3. Process-local, so it broke across serverless instances (and a retry on a fresh
 *      instance simply saw no challenge).
 */
import { randomInt, createHash, timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"

export const OTP_TTL_MINUTES = 10
export const OTP_MAX_ATTEMPTS = 5
export const OTP_LENGTH = 6

/** Codes are compared by hash; they are never stored or logged in the clear. */
function hashCode(userId: string, purpose: string, code: string): string {
  return createHash("sha256").update(`${userId}:${purpose}:${code}`).digest("hex")
}

/** Cryptographically secure numeric code, zero-padded (leading zeros are legal codes). */
export function generateCode(length = OTP_LENGTH): string {
  const max = 10 ** length
  return String(randomInt(0, max)).padStart(length, "0")
}

/**
 * Create a challenge, invalidating any previous one for this (user, purpose) so only the
 * newest code works. Returns the PLAINTEXT code for delivery — never persist it.
 */
export async function createOtp(userId: string, purpose = "login", now: Date = new Date()): Promise<string> {
  const code = generateCode()
  await (prisma as any).otpChallenge.deleteMany({ where: { userId, purpose } })
  await (prisma as any).otpChallenge.create({
    data: {
      userId, purpose,
      codeHash: hashCode(userId, purpose, code),
      expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000),
    },
  })
  return code
}

export type OtpFailure = "not_found" | "expired" | "too_many_attempts" | "incorrect"
export type OtpResult = { ok: true } | { ok: false; reason: OtpFailure; attemptsLeft?: number }

/**
 * Verify and CONSUME a code. Every wrong guess burns an attempt; past the cap the
 * challenge is dead and the user must request a new code — which is what makes brute
 * force infeasible.
 */
export async function verifyOtp(userId: string, purpose: string, code: string, now: Date = new Date()): Promise<OtpResult> {
  const row = await (prisma as any).otpChallenge.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  })
  if (!row) return { ok: false, reason: "not_found" }
  if (now > new Date(row.expiresAt)) {
    await (prisma as any).otpChallenge.deleteMany({ where: { id: row.id } })
    return { ok: false, reason: "expired" }
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await (prisma as any).otpChallenge.deleteMany({ where: { id: row.id } })
    return { ok: false, reason: "too_many_attempts" }
  }

  // Count the attempt BEFORE comparing, so a crash mid-verify cannot yield a free guess.
  const bumped = await (prisma as any).otpChallenge.update({
    where: { id: row.id },
    data: { attempts: { increment: 1 } },
    select: { attempts: true },
  })

  const supplied = Buffer.from(hashCode(userId, purpose, String(code).trim()))
  const expected = Buffer.from(row.codeHash)
  const match = supplied.length === expected.length && timingSafeEqual(supplied, expected)

  if (!match) {
    const left = Math.max(0, OTP_MAX_ATTEMPTS - bumped.attempts)
    if (left === 0) await (prisma as any).otpChallenge.deleteMany({ where: { id: row.id } })
    return { ok: false, reason: "incorrect", attemptsLeft: left }
  }

  // Single use: consume atomically so a replayed code cannot mint a second session.
  const consumed = await (prisma as any).otpChallenge.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: now },
  })
  if (consumed.count === 0) return { ok: false, reason: "not_found" }
  return { ok: true }
}

/** Delete expired/consumed challenges — called by the maintenance cron. */
export async function sweepOtps(now: Date = new Date()): Promise<number> {
  const r = await (prisma as any).otpChallenge.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }] },
  })
  return r.count ?? 0
}
