import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { hasFeature, FEATURE_UPGRADE, FEATURE_LABEL, type Feature } from "@/lib/entitlements"

/* Server-side tier/role enforcement. Hiding a nav item is not access control —
 * a lower-tier or job-seeker account must be blocked at the API too. This loads
 * the real plan from the DB (never trusts the client) and checks the same
 * hasFeature() the UI uses, so the map in lib/entitlements.ts is the one source
 * of truth for both. Admins/super-admins pass (see hasFeature).
 *
 * Usage in a route handler:
 *   const g = await requireFeature(req, "hrms")
 *   if ("error" in g) return NextResponse.json({ error: g.error, upgrade: g.upgrade }, { status: g.status })
 *   // ...g.user is { id, role, plan }
 */
export type Guarded =
  | { user: { id: string; role: string; plan: string | null } }
  | { error: string; status: 401 | 403; upgrade?: string }

export async function requireFeature(req: NextRequest, feature: Feature): Promise<Guarded> {
  const token = req.cookies.get("er_token")?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return { error: "Not authenticated", status: 401 }
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, role: true, plan: true } })
  if (!user) return { error: "Not authenticated", status: 401 }
  if (!hasFeature(user, feature)) {
    const up = FEATURE_UPGRADE[feature]
    return { error: `${FEATURE_LABEL[feature]} is available on the ${up.name} plan.`, status: 403, upgrade: up.plan }
  }
  return { user: { id: user.id, role: user.role, plan: user.plan } }
}

/** Convenience wrapper: returns the NextResponse to send on failure, else null. */
export async function featureGate(req: NextRequest, feature: Feature): Promise<{ user: { id: string; role: string; plan: string | null } } | NextResponse> {
  const g = await requireFeature(req, feature)
  if ("error" in g) return NextResponse.json({ error: g.error, upgrade: g.upgrade }, { status: g.status })
  return g
}
