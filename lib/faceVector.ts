import crypto from "crypto"

// Real key always comes from FACE_VECTOR_KEY in prod; this fallback is dev-only.
const KEY = process.env.FACE_VECTOR_KEY || "vrittih_face_key_32bytes_secure!"
const KEY32 = KEY.padEnd(32).slice(0,32)

export function encryptVector(vector: number[]): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(KEY32), iv)
  const json = JSON.stringify(vector)
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()])
  return iv.toString("hex") + ":" + encrypted.toString("hex")
}

export function decryptVector(encrypted: string): number[] {
  const [ivHex, dataHex] = encrypted.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const data = Buffer.from(dataHex, "hex")
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(KEY32), iv)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(decrypted.toString("utf8"))
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return 999
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0))
}

export function hashId(idNumber: string): string {
  return crypto.createHash("sha256").update(idNumber.trim().toUpperCase()).digest("hex")
}

export function fuzzyNameMatch(name1: string, name2: string): number {
  const a = name1.toLowerCase().trim()
  const b = name2.toLowerCase().trim()
  if (a === b) return 1.0
  const wordsA = a.split(/\s+/)
  const wordsB = b.split(/\s+/)
  const matches = wordsA.filter(w => wordsB.includes(w)).length
  return matches / Math.max(wordsA.length, wordsB.length)
}

export const MATCH_THRESHOLD = 0.45
export const UNCERTAIN_THRESHOLD = 0.60