/**
 * Vrittih in-house DKIM (RFC 6376) — email domain-key signing & verification.
 *
 * Lets a verified employer domain send DKIM-signed mail so receivers can
 * cryptographically confirm the platform is authorised to send as that domain.
 * relaxed/relaxed canonicalization, RSA-SHA256, built on Node crypto only.
 * No third-party libraries.
 */
import { createHash, createSign, createVerify, generateKeyPairSync, createPublicKey } from "crypto"

export interface DkimKeyPair {
  privateKeyPem: string
  publicKeyPem: string
  dnsPublicKey: string // base64 SPKI DER for the DNS TXT record's p= tag
}

/** Generate an RSA-2048 DKIM key pair. */
export function generateDkimKeyPair(): DkimKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }) as string,
    dnsPublicKey: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("base64"),
  }
}

// ---------- canonicalization (relaxed, RFC 6376 §3.4.3 / §3.4.4) ----------

/** Relaxed body canonicalization. */
export function canonicalizeBodyRelaxed(body: string): string {
  // Normalise line endings to CRLF first.
  let b = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines = b.split("\n")
  const out = lines.map((line) =>
    line.replace(/[ \t]+/g, " ")  // reduce WSP sequences to single SP
        .replace(/[ \t]+$/g, "")  // strip trailing WSP
  )
  let result = out.join("\r\n")
  // Remove trailing empty lines, then ensure exactly one trailing CRLF.
  result = result.replace(/(\r\n)+$/g, "")
  return result.length === 0 ? "\r\n" : result + "\r\n"
}

/** Relaxed header canonicalization for a single "Name: value" header. */
export function canonicalizeHeaderRelaxed(name: string, value: string): string {
  const n = name.toLowerCase().trim()
  const v = value
    .replace(/\r\n/g, "")      // unfold
    .replace(/[ \t]+/g, " ")   // reduce WSP to single SP
    .replace(/[ \t]+$/g, "")   // strip trailing WSP
    .replace(/^[ \t]+/, "")    // strip leading WSP (WSP immediately after colon)
  return `${n}:${v}`
}

const b64 = (buf: Buffer) => buf.toString("base64")

export interface SignOptions {
  privateKeyPem: string
  domain: string
  selector: string
  headers: { name: string; value: string }[] // in the order to be signed
  body: string
  signHeaders?: string[]  // which header names to sign (default: all provided)
  timestamp?: number
}

/** Produce the full "DKIM-Signature: ..." header line for a message. */
export function signMessage(opts: SignOptions): string {
  const t = opts.timestamp ?? Math.floor(Date.now() / 1000)
  const bodyCanon = canonicalizeBodyRelaxed(opts.body)
  const bh = b64(createHash("sha256").update(bodyCanon, "utf8").digest())

  const hNames = (opts.signHeaders ?? opts.headers.map((h) => h.name)).map((h) => h.toLowerCase())

  // Build the DKIM-Signature value (b= empty for signing).
  const dkimBase =
    `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${opts.domain}; s=${opts.selector}; ` +
    `t=${t}; bh=${bh}; h=${hNames.join(":")}; b=`

  // Canonicalized signed headers, in h= order.
  const headerByName = new Map(opts.headers.map((h) => [h.name.toLowerCase(), h]))
  let signingInput = ""
  for (const hn of hNames) {
    const h = headerByName.get(hn)
    if (h) signingInput += canonicalizeHeaderRelaxed(h.name, h.value) + "\r\n"
  }
  // Plus the DKIM-Signature header itself, canonicalized, NO trailing CRLF.
  signingInput += canonicalizeHeaderRelaxed("dkim-signature", dkimBase)

  const signature = createSign("RSA-SHA256").update(signingInput, "utf8").sign(opts.privateKeyPem)
  const b = b64(signature)
  return `DKIM-Signature: ${dkimBase}${b}`
}

export interface VerifyOptions {
  dkimSignatureHeader: string  // the full "DKIM-Signature: ..." line value (without the name)
  headers: { name: string; value: string }[]
  body: string
  publicKeyDer: string  // base64 SPKI DER (the p= tag from DNS)
}

/** Verify a DKIM signature. Returns true iff both body hash and signature are valid. */
export function verifyMessage(opts: VerifyOptions): boolean {
  const tags = parseDkimTags(opts.dkimSignatureHeader)
  if (!tags.b || !tags.bh || !tags.h) return false

  // 1. body hash
  const bodyCanon = canonicalizeBodyRelaxed(opts.body)
  const bh = b64(createHash("sha256").update(bodyCanon, "utf8").digest())
  if (bh !== tags.bh) return false

  // 2. rebuild signing input with b= emptied
  const hNames = tags.h.split(":").map((s) => s.trim().toLowerCase())
  const headerByName = new Map(opts.headers.map((h) => [h.name.toLowerCase(), h]))
  let signingInput = ""
  for (const hn of hNames) {
    const h = headerByName.get(hn)
    if (h) signingInput += canonicalizeHeaderRelaxed(h.name, h.value) + "\r\n"
  }
  const dkimBaseEmptyB = opts.dkimSignatureHeader
    .replace(/^DKIM-Signature:\s*/i, "")  // tolerate callers passing the full header line
    .replace(/\bb=[^;]*/, "b=")
    .trim()
  signingInput += canonicalizeHeaderRelaxed("dkim-signature", dkimBaseEmptyB)

  const publicKey = createPublicKey({
    key: Buffer.from(opts.publicKeyDer, "base64"),
    format: "der",
    type: "spki",
  })
  return createVerify("RSA-SHA256").update(signingInput, "utf8").verify(publicKey, Buffer.from(tags.b, "base64"))
}

function parseDkimTags(header: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of header.replace(/^DKIM-Signature:\s*/i, "").split(";")) {
    const idx = part.indexOf("=")
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim().replace(/\s+/g, "")
    if (k) out[k] = v
  }
  return out
}

/** DNS TXT record value that publishes the public key for a selector. */
export function dkimDnsRecord(dnsPublicKey: string): string {
  return `v=DKIM1; k=rsa; p=${dnsPublicKey}`
}
