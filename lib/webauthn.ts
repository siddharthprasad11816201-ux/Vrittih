/**
 * Vrittih in-house WebAuthn (passkey / fingerprint) server verification.
 *
 * Uses the browser's native navigator.credentials API on the client and
 * Node's crypto on the server. Attestation objects are parsed with our own
 * CBOR decoder, COSE keys converted to JWK by hand, and assertion signatures
 * verified with crypto.verify. Zero third-party libraries.
 */
import { createHash, createPublicKey, randomBytes, verify as cryptoVerify, type KeyObject } from "crypto"
import { cborDecode, cborDecodeFirst, type CborMap } from "@/lib/cbor"
import { prisma } from "@/lib/prisma"

export const RP_NAME = "Vrittih"

// ---------- base64url ----------
export const b64url = {
  encode: (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  decode: (str: string) => Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
}

// ---------- challenge store ----------
// Persisted in the DB: Next bundles each route separately, so module-level
// memory is NOT shared between the options and verify routes.
export async function issueChallenge(key: string): Promise<string> {
  const challenge = b64url.encode(randomBytes(32))
  const expiresAt = new Date(Date.now() + 5 * 60_000)
  await prisma.authChallenge.upsert({
    where: { key },
    update: { challenge, expiresAt },
    create: { key, challenge, expiresAt },
  })
  return challenge
}

export async function consumeChallenge(key: string): Promise<string | null> {
  const entry = await prisma.authChallenge.findUnique({ where: { key } })
  if (entry) await prisma.authChallenge.delete({ where: { key } }).catch(() => {})
  if (!entry || Date.now() > entry.expiresAt.getTime()) return null
  return entry.challenge
}

// ---------- parsing ----------
export interface ParsedAuthData {
  rpIdHash: Buffer
  flags: number
  userPresent: boolean
  userVerified: boolean
  counter: number
  credentialId?: Buffer
  publicKeyJwk?: Record<string, string>
  publicKeyAlg?: number
}

/** Convert a COSE key (CBOR map) to a JWK Node's crypto can consume. */
function coseKeyToJwk(cose: CborMap): { jwk: Record<string, string>; alg: number } {
  const kty = cose.get(1) as number
  const alg = cose.get(3) as number
  if (kty === 2) {
    // EC2 — P-256 (ES256, alg -7)
    const x = cose.get(-2) as Buffer
    const y = cose.get(-3) as Buffer
    if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) throw new Error("WebAuthn: malformed EC2 key")
    return { jwk: { kty: "EC", crv: "P-256", x: b64url.encode(x), y: b64url.encode(y) }, alg }
  }
  if (kty === 3) {
    // RSA (RS256, alg -257)
    const n = cose.get(-1) as Buffer
    const e = cose.get(-2) as Buffer
    if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e)) throw new Error("WebAuthn: malformed RSA key")
    return { jwk: { kty: "RSA", n: b64url.encode(n), e: b64url.encode(e) }, alg }
  }
  throw new Error(`WebAuthn: unsupported COSE key type ${kty}`)
}

/** Parse WebAuthn authenticatorData (attested credential data included on registration). */
export function parseAuthData(authData: Buffer): ParsedAuthData {
  if (authData.length < 37) throw new Error("WebAuthn: authData too short")
  const rpIdHash = authData.subarray(0, 32)
  const flags = authData[32]
  const counter = authData.readUInt32BE(33)
  const parsed: ParsedAuthData = {
    rpIdHash: Buffer.from(rpIdHash),
    flags,
    userPresent: (flags & 0x01) !== 0,
    userVerified: (flags & 0x04) !== 0,
    counter,
  }
  if (flags & 0x40) {
    // Attested credential data: AAGUID(16) credIdLen(2) credId credPubKey(COSE)
    let pos = 37 + 16
    const credIdLen = authData.readUInt16BE(pos)
    pos += 2
    parsed.credentialId = Buffer.from(authData.subarray(pos, pos + credIdLen))
    pos += credIdLen
    const { value } = cborDecodeFirst(authData.subarray(pos))
    const { jwk, alg } = coseKeyToJwk(value as CborMap)
    parsed.publicKeyJwk = jwk
    parsed.publicKeyAlg = alg
  }
  return parsed
}

export interface RegistrationResult {
  credentialId: string        // base64url
  publicKeyJwk: Record<string, string>
  publicKeyAlg: number
  counter: number
}

/**
 * Verify a registration (attestation) response.
 * We request attestation "none", so the trust anchor is the origin+challenge
 * binding in clientDataJSON plus rpIdHash — no CA chain to validate.
 */
export function verifyRegistration(opts: {
  attestationObjectB64: string
  clientDataJSONB64: string
  expectedChallenge: string
  expectedOrigin: string
  expectedRpId: string
}): RegistrationResult {
  const clientData = JSON.parse(b64url.decode(opts.clientDataJSONB64).toString("utf8"))
  if (clientData.type !== "webauthn.create") throw new Error("WebAuthn: wrong clientData type")
  if (clientData.challenge !== opts.expectedChallenge) throw new Error("WebAuthn: challenge mismatch")
  if (clientData.origin !== opts.expectedOrigin) throw new Error(`WebAuthn: origin mismatch (${clientData.origin})`)

  const attestation = cborDecode(b64url.decode(opts.attestationObjectB64)) as CborMap
  const authData = attestation.get("authData") as Buffer
  if (!Buffer.isBuffer(authData)) throw new Error("WebAuthn: missing authData")

  const parsed = parseAuthData(authData)
  const expectedRpIdHash = createHash("sha256").update(opts.expectedRpId).digest()
  if (!parsed.rpIdHash.equals(expectedRpIdHash)) throw new Error("WebAuthn: rpIdHash mismatch")
  if (!parsed.userPresent) throw new Error("WebAuthn: user not present")
  if (!parsed.credentialId || !parsed.publicKeyJwk) throw new Error("WebAuthn: no attested credential data")

  return {
    credentialId: b64url.encode(parsed.credentialId),
    publicKeyJwk: parsed.publicKeyJwk,
    publicKeyAlg: parsed.publicKeyAlg ?? -7,
    counter: parsed.counter,
  }
}

/** Verify an authentication (assertion) response against a stored credential. */
export function verifyAssertion(opts: {
  authenticatorDataB64: string
  clientDataJSONB64: string
  signatureB64: string
  expectedChallenge: string
  expectedOrigin: string
  expectedRpId: string
  publicKeyJwk: Record<string, string>
  publicKeyAlg: number
  storedCounter: number
}): { counter: number } {
  const clientDataRaw = b64url.decode(opts.clientDataJSONB64)
  const clientData = JSON.parse(clientDataRaw.toString("utf8"))
  if (clientData.type !== "webauthn.get") throw new Error("WebAuthn: wrong clientData type")
  if (clientData.challenge !== opts.expectedChallenge) throw new Error("WebAuthn: challenge mismatch")
  if (clientData.origin !== opts.expectedOrigin) throw new Error(`WebAuthn: origin mismatch (${clientData.origin})`)

  const authData = b64url.decode(opts.authenticatorDataB64)
  const parsed = parseAuthData(authData)
  const expectedRpIdHash = createHash("sha256").update(opts.expectedRpId).digest()
  if (!parsed.rpIdHash.equals(expectedRpIdHash)) throw new Error("WebAuthn: rpIdHash mismatch")
  if (!parsed.userPresent) throw new Error("WebAuthn: user not present")

  // Signature is over authenticatorData || SHA256(clientDataJSON)
  const signedData = Buffer.concat([authData, createHash("sha256").update(clientDataRaw).digest()])
  const key: KeyObject = createPublicKey({ key: opts.publicKeyJwk as any, format: "jwk" })
  const signature = b64url.decode(opts.signatureB64)

  let ok: boolean
  if (opts.publicKeyAlg === -7) {
    // ES256 — WebAuthn delivers an ASN.1/DER ECDSA signature, which Node accepts directly.
    ok = cryptoVerify("sha256", signedData, { key, dsaEncoding: "der" }, signature)
  } else if (opts.publicKeyAlg === -257) {
    // RS256
    ok = cryptoVerify("sha256", signedData, key, signature)
  } else {
    throw new Error(`WebAuthn: unsupported algorithm ${opts.publicKeyAlg}`)
  }
  if (!ok) throw new Error("WebAuthn: invalid signature")

  // Counter regression check (clone detection). Some platform authenticators
  // always report 0 — only enforce when the authenticator actually increments.
  if (parsed.counter !== 0 && parsed.counter <= opts.storedCounter) {
    throw new Error("WebAuthn: counter did not increase — possible cloned authenticator")
  }
  return { counter: parsed.counter }
}

/** Derive rpId + origin from a request's Origin/Host headers (dev-friendly). */
export function rpFromRequest(origin: string | null, host: string | null): { rpId: string; origin: string } {
  if (origin) {
    const url = new URL(origin)
    return { rpId: url.hostname, origin }
  }
  const hostname = (host || "localhost:3000").split(":")[0]
  return { rpId: hostname, origin: `http://${host || "localhost:3000"}` }
}
