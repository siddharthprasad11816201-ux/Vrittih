/**
 * Step-up authentication challenge.
 *
 * THE BUG THIS CLOSES: login step 1 previously returned a bare `userId`, and step 2
 * (/auth/otp-verify, /auth/totp/verify, /verify/face-verify) accepted that `userId` from
 * the request body. Anyone who knew a user id could therefore call step 2 directly and
 * mint a full 7-day session WITHOUT EVER PROVING THE PASSWORD. Second factors became the
 * ONLY factor, and for email OTP the code was brute-forceable (see OtpChallenge).
 *
 * A challenge token is now issued only after the password verifies, and step 2 refuses to
 * run without it.
 *
 * It is deliberately NOT produced by lib/jwt.signToken: that mints a real SESSION token,
 * and anything shaped like one could be replayed into the auth cookie. This is a distinct,
 * purpose-bound, short-lived HMAC that setAuthCookie/verifyToken will never accept.
 */
import { createHmac, timingSafeEqual, randomBytes } from "crypto"

const DEV_SECRET = "dev_secret_change_in_production"
const SECRET = process.env.JWT_SECRET || DEV_SECRET
if (process.env.NODE_ENV === "production" && SECRET === DEV_SECRET) {
  throw new Error("JWT_SECRET must be set in production — refusing to issue auth challenges with the dev fallback secret.")
}

/** Which second factor the challenge authorises. A token for one stage cannot be used for another. */
export type ChallengeStage = "2fa_email" | "2fa_totp" | "face"

/** Short by design: a step-up window is minutes, not days. */
export const CHALLENGE_TTL_SECONDS = 10 * 60

const b64u = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const unb64u = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")

/** `<payload-b64>.<sig-b64>` where payload = {u, s, exp, n}. */
export function issueChallenge(userId: string, stage: ChallengeStage, now: Date = new Date()): string {
  const payload = {
    u: userId,
    s: stage,
    exp: Math.floor(now.getTime() / 1000) + CHALLENGE_TTL_SECONDS,
    n: randomBytes(9).toString("base64url"),   // uniqueness, so two challenges never collide
  }
  const body = b64u(Buffer.from(JSON.stringify(payload)))
  const sig = b64u(createHmac("sha256", SECRET).update(`chal.${body}`).digest())
  return `${body}.${sig}`
}

export interface ChallengeResult { valid: boolean; userId?: string; stage?: ChallengeStage; reason?: string }

/**
 * Verify a challenge against the expected stage (or any of several — the face-login
 * "injury" fallback legitimately continues into the email-OTP flow). Fails closed.
 */
export function verifyChallenge(token: string | null | undefined, expected: ChallengeStage | ChallengeStage[], now: Date = new Date()): ChallengeResult {
  const allowed = Array.isArray(expected) ? expected : [expected]
  if (!token || typeof token !== "string") return { valid: false, reason: "missing" }
  const parts = token.split(".")
  if (parts.length !== 2) return { valid: false, reason: "malformed" }
  const [body, sig] = parts

  const expectedSig = b64u(createHmac("sha256", SECRET).update(`chal.${body}`).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  // Length check first — timingSafeEqual throws on a length mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false, reason: "bad_signature" }

  let payload: any
  try { payload = JSON.parse(unb64u(body).toString("utf8")) } catch { return { valid: false, reason: "malformed" } }
  if (!payload?.u || !payload?.s) return { valid: false, reason: "malformed" }
  if (!allowed.includes(payload.s)) return { valid: false, reason: "wrong_stage" }
  if (typeof payload.exp !== "number" || Math.floor(now.getTime() / 1000) > payload.exp) return { valid: false, reason: "expired" }

  return { valid: true, userId: String(payload.u), stage: payload.s as ChallengeStage }
}

/** Read the challenge from the body or the X-Auth-Challenge header. */
export function challengeFrom(body: any, req?: { headers: { get(n: string): string | null } }): string | null {
  const fromBody = body && typeof body.challenge === "string" ? body.challenge : null
  return fromBody || req?.headers.get("x-auth-challenge") || null
}
