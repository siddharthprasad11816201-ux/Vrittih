/**
 * Vrittih in-house TOTP (Time-based One-Time Password) implementation.
 *
 * RFC 4226 (HOTP) + RFC 6238 (TOTP), built on Node's crypto module only —
 * zero third-party libraries. Compatible with Google Authenticator, Duo,
 * Microsoft Authenticator, Aegis, and any standard authenticator app.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto"

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

/** RFC 4648 base32 encode (no padding — authenticator apps don't need it). */
export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ""
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

/** RFC 4648 base32 decode (case-insensitive, ignores padding/spaces). */
export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[\s=]/g, "")
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx === -1) throw new Error("Invalid base32 character")
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** Generate a new 160-bit TOTP secret (the RFC 4226 recommended length). */
export function generateTOTPSecret(): string {
  return base32Encode(randomBytes(20))
}

/** RFC 4226 HOTP: HMAC-SHA1 truncated to `digits` decimal digits. */
export function hotp(secretBase32: string, counter: number, digits = 6): string {
  const key = base32Decode(secretBase32)
  const msg = Buffer.alloc(8)
  // Write the 64-bit counter big-endian (JS-safe: counters stay < 2^53).
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  msg.writeUInt32BE(counter >>> 0, 4)
  const digest = createHmac("sha1", key).update(msg).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  return String(code % 10 ** digits).padStart(digits, "0")
}

/** RFC 6238 TOTP for a given unix time (default: now), 30-second steps. */
export function totp(secretBase32: string, timeMs = Date.now(), stepSeconds = 30, digits = 6): string {
  return hotp(secretBase32, Math.floor(timeMs / 1000 / stepSeconds), digits)
}

/**
 * Verify a submitted code against the secret, accepting a ±window of time
 * steps (default ±1 step = ±30s) to tolerate clock drift.
 */
export function verifyTOTP(secretBase32: string, code: string, window = 1): boolean {
  const submitted = code.replace(/\s/g, "")
  if (!/^\d{6}$/.test(submitted)) return false
  const counter = Math.floor(Date.now() / 1000 / 30)
  for (let w = -window; w <= window; w++) {
    const expected = hotp(secretBase32, counter + w)
    const a = Buffer.from(expected)
    const b = Buffer.from(submitted)
    if (a.length === b.length && timingSafeEqual(a, b)) return true
  }
  return false
}

/** otpauth:// URI — paste or QR-encode into any authenticator app. */
export function buildOtpauthURI(secretBase32: string, accountEmail: string, issuer = "Vrittih"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`)
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: "6", period: "30" })
  return `otpauth://totp/${label}?${params.toString()}`
}

/** Group a base32 secret into 4-char blocks for readable manual entry. */
export function formatSecret(secretBase32: string): string {
  return secretBase32.match(/.{1,4}/g)?.join(" ") ?? secretBase32
}
