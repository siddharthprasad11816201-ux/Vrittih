/**
 * Application-level encryption at rest for secrets stored in the database.
 *
 * Node's built-in crypto only (no third-party dependency). AES-256-GCM gives
 * confidentiality AND integrity — a tampered ciphertext fails to decrypt rather than
 * silently yielding garbage.
 *
 * Format:  v1.<iv-b64>.<tag-b64>.<ciphertext-b64>
 * The version prefix means a future algorithm change can be rolled out without guessing.
 *
 * Key: SECRET_ENCRYPTION_KEY (base64 or hex, 32 bytes). If it is not configured, values
 * are stored as plaintext exactly as before — encryption is opt-in so an existing
 * deployment cannot be locked out of its own data by a missing env var. isEncrypted()
 * lets readers transparently handle both, which makes the migration lazy and safe.
 */
import crypto from "crypto"

const PREFIX = "v1."

let cachedKey: Buffer | null | undefined

/** 32-byte key from env, or null when encryption is not configured. */
export function encryptionKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey
  const raw = process.env.SECRET_ENCRYPTION_KEY || ""
  if (!raw) { cachedKey = null; return null }
  let buf: Buffer | null = null
  try {
    if (/^[0-9a-f]{64}$/i.test(raw)) buf = Buffer.from(raw, "hex")
    else {
      const b = Buffer.from(raw, "base64")
      if (b.length === 32) buf = b
    }
  } catch { buf = null }
  if (!buf || buf.length !== 32) {
    // Misconfigured key: refuse to pretend things are encrypted.
    console.error("[secretbox] SECRET_ENCRYPTION_KEY must be 32 bytes (base64 or hex) — encryption disabled")
    cachedKey = null
    return null
  }
  cachedKey = buf
  return cachedKey
}

/** Reset the memoised key (tests). */
export function _resetKeyCache() { cachedKey = undefined }

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX) && value.split(".").length === 4
}

export function encryptionEnabled(): boolean { return encryptionKey() !== null }

/** Encrypt. Returns the value UNCHANGED when no key is configured (documented fallback). */
export function encryptSecret(plain: string): string {
  const key = encryptionKey()
  if (!key) return plain
  if (isEncrypted(plain)) return plain          // never double-encrypt
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()])
  const tag = c.getAuthTag()
  return `${PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`
}

/**
 * Decrypt. A value that is not in the encrypted format is returned as-is — that is how
 * rows written before encryption was enabled keep working.
 * Throws when a value IS encrypted but cannot be decrypted: silently returning a broken
 * key would produce invalid mail signatures that are far harder to diagnose.
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored
  const key = encryptionKey()
  if (!key) throw new Error("Encrypted secret found but SECRET_ENCRYPTION_KEY is not configured")
  const [, ivB64, tagB64, ctB64] = stored.split(".")
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"))
  d.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([d.update(Buffer.from(ctB64, "base64")), d.final()]).toString("utf8")
}

/** Mask a secret for logs/UI. Never log the real value. */
export function maskSecret(v: string | null | undefined): string {
  if (!v) return ""
  if (isEncrypted(v)) return "[encrypted]"
  const s = String(v)
  return s.length <= 8 ? "********" : `${s.slice(0, 4)}…${s.slice(-2)} (${s.length} chars)`
}

/** Generate a fresh key for operators to put in SECRET_ENCRYPTION_KEY. */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64")
}
