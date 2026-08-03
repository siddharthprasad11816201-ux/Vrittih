import crypto from "crypto"

/* Verifiable certificate helpers. Serial is human-readable; verification code is
 * an opaque public secret. certStatus is pure (unit-tested). SERVER for the
 * generators (crypto); certStatus is safe anywhere. */

export function newSerial(date: Date = new Date()): string {
  const y = date.getUTCFullYear()
  const rand = crypto.randomBytes(5).toString("base64url").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6).padEnd(6, "0")
  return `VRT-${y}-${rand}`
}

export function newVerificationCode(): string {
  return crypto.randomBytes(12).toString("base64url")
}

export type CertStatus = "valid" | "revoked" | "expired"

export function certStatus(c: { revoked?: boolean; expiresAt?: Date | string | null }, now: Date = new Date()): CertStatus {
  if (c.revoked) return "revoked"
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now.getTime()) return "expired"
  return "valid"
}

export const CERT_KINDS = ["internship", "course", "assessment", "achievement"] as const
