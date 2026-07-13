/**
 * Vrittih in-house JWT (JWS HS256) — replaces `jsonwebtoken`.
 * Standard-compliant tokens (RFC 7519) built on Node `crypto` only, so
 * existing sessions signed with the same secret keep verifying. Zero deps.
 */
import { createHmac, timingSafeEqual } from "crypto"

const DEV_SECRET = "dev_secret_change_in_production"
const SECRET = process.env.JWT_SECRET || DEV_SECRET
// Fail closed: never sign/verify with the known dev fallback in production, or
// anyone could forge session tokens and take over accounts.
if (process.env.NODE_ENV === "production" && SECRET === DEV_SECRET) {
  throw new Error("JWT_SECRET must be set in production — refusing to run with the dev fallback secret.")
}
const EXPIRY = process.env.JWT_EXPIRY || "7d"

export interface JWTPayload {
  userId: string
  email: string
  role: string
  paid: boolean
  iat?: number
  exp?: number
}

const b64url = {
  enc: (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
}

function expirySeconds(v: string): number {
  const m = /^(\d+)([smhd])?$/.exec(v.trim())
  if (!m) return 7 * 86400
  const n = parseInt(m[1], 10)
  return n * ({ s: 1, m: 60, h: 3600, d: 86400 }[m[2] || "s"] ?? 1)
}

function sign(input: string): string {
  return b64url.enc(createHmac("sha256", SECRET).update(input).digest())
}

export function signToken(payload: JWTPayload): string {
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expirySeconds(EXPIRY) }
  const header = b64url.enc(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const claims = b64url.enc(JSON.stringify(body))
  const data = `${header}.${claims}`
  return `${data}.${sign(data)}`
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const [header, claims, sig] = parts
    const expected = sign(`${header}.${claims}`)
    const a = Buffer.from(sig), b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(b64url.dec(claims).toString("utf8")) as JWTPayload
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
