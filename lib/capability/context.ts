/* Phase 1 · Module 6 — the Context Engine. Resolves an authenticated request into
 * an identity + its derived capability set, the single object routes/widgets/
 * agents authorize against. Fail-closed: an unresolved request has no capabilities. */
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { deriveCapabilities } from "@/lib/capability/derive"
import { can, authorize } from "@/lib/capability/policy"

export type PlatformContext = {
  userId: string | null
  user: { id: string; name: string; role: string | null; plan: string | null } | null
  capabilities: Set<string>
  has: (capability: string) => boolean
  authorize: (required: string | string[], mode?: "all" | "any") => boolean
}

function anon(): PlatformContext {
  const caps = new Set<string>()
  return { userId: null, user: null, capabilities: caps, has: () => false, authorize: () => false }
}

export async function resolveContext(req: NextRequest): Promise<PlatformContext> {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  if (!p) return anon()
  const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { id: true, name: true, role: true, plan: true } }).catch(() => null)
  if (!user) return anon()
  const capabilities = deriveCapabilities(user)
  return {
    userId: user.id, user, capabilities,
    has: (c) => can(capabilities, c),
    authorize: (r, m) => authorize(capabilities, r, m),
  }
}

/** Route guard: returns the context if the subject holds the capability, else null
 * (the route should respond 403). */
export async function requireCapability(req: NextRequest, capability: string | string[]): Promise<PlatformContext | null> {
  const ctx = await resolveContext(req)
  return ctx.authorize(capability) ? ctx : null
}
