/**
 * Helpers for the remaining secrets held in the database.
 *
 * Three secrets needed three DIFFERENT treatments, because "encrypt it" is not always the
 * right answer:
 *
 *  - Webhook.secret is read back to sign a payload  -> ENCRYPT (reversible, needed intact).
 *  - User.twoFactorSecret is read back to verify a code -> ENCRYPT, but the "totp:"
 *    discriminator stays in the clear so login can tell TOTP from email OTP without
 *    decrypting anything.
 *  - User.calendarToken is a LOOKUP KEY -> HASH. Encrypting it would break the query
 *    outright, since a random IV makes the ciphertext differ every time.
 *
 * Every function degrades safely on values written before this existed, so the migration
 * is lazy and nothing has to be rewritten in a big-bang update.
 */
import { createHash, timingSafeEqual } from "crypto"
import { encryptSecret, decryptSecret, isEncrypted } from "./secretbox"

/* ---------------- reversible secrets ---------------- */

export function protectSecret(plain: string): string {
  return encryptSecret(plain)
}

/** Read a protected secret. Legacy plaintext passes straight through. */
export function revealSecret(stored: string | null | undefined): string {
  if (!stored) return ""
  return decryptSecret(stored)
}

/* ---------------- TOTP ---------------- */

const TOTP_PREFIX = "totp:"

/**
 * Store a TOTP secret as `totp:<ciphertext>`.
 * The prefix is deliberately OUTSIDE the ciphertext: login only needs to know WHICH second
 * factor is configured, and it should not have to decrypt a secret to answer that.
 */
export function protectTotp(secret: string): string {
  return TOTP_PREFIX + encryptSecret(secret)
}

export function isTotp(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(TOTP_PREFIX)
}

/** Recover the base32 TOTP secret. Handles rows written before encryption. */
export function revealTotp(stored: string | null | undefined): string | null {
  if (!isTotp(stored)) return null
  const body = (stored as string).slice(TOTP_PREFIX.length)
  if (!body) return null
  return isEncrypted(body) ? decryptSecret(body) : body
}

/* ---------------- lookup-key secrets ---------------- */

/**
 * Deterministic hash for a bearer token used as a lookup key.
 *
 * SHA-256 without a salt is correct here and NOT a password-hashing mistake: the token is
 * 32 bytes of cryptographic randomness, so there is no dictionary to attack, and the hash
 * must be deterministic or it could not be looked up.
 */
export function hashLookupToken(token: string): string {
  return "h1:" + createHash("sha256").update(String(token)).digest("hex")
}

export function isHashedToken(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith("h1:")
}

/** Constant-time comparison of a supplied token against a stored value (hashed or legacy). */
export function tokenMatches(supplied: string, stored: string | null | undefined): boolean {
  if (!stored || !supplied) return false
  const expected = isHashedToken(stored) ? stored : hashLookupToken(stored)
  const actual = hashLookupToken(supplied)
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
