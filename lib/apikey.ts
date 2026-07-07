import crypto from "crypto"
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

// Public API keys. The raw token is shown once at issue; we store only its hash.
export function generateApiKey(): string {
  return "vk_live_" + crypto.randomBytes(24).toString("hex")
}
export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex")
}
export function keyPrefix(raw: string): string {
  return raw.slice(0, 16) + "…"
}

// Authenticate a public API request via `Authorization: Bearer vk_live_…`.
export async function authApiKey(req: NextRequest): Promise<{ employerId: string; keyId: string } | null> {
  const h = req.headers.get("authorization") || ""
  const m = h.match(/Bearer\s+(vk_[A-Za-z0-9_]+)/)
  if (!m) return null
  const rec = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(m[1]) } })
  if (!rec || !rec.active) return null
  prisma.apiKey.update({ where: { id: rec.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  return { employerId: rec.employerId, keyId: rec.id }
}
