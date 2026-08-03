import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { verifyToken } from "@/lib/jwt"
import { describeDevice } from "@/lib/account/loginHistory"

export const dynamic = "force-dynamic"

/* Phase 1 · Module 5 — real sign-in & security activity for the current subject.
 * Login history comes from LoginAttempt (written on every sign-in completion);
 * the security audit comes from ActivityLog. The "current session" is derived
 * from the live request + JWT claims (no session store required for this view). */

const SECURITY_ACTIONS = new Set([
  "2fa.enabled", "2fa.disabled", "passkey.added", "passkey.removed",
  "password.changed", "face.enrolled", "face.updated", "id.verified",
  "account.deleted", "session.signout",
])

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ authenticated: false }, { status: 401 })

  const token = req.cookies.get("er_token")?.value
  const payload = token ? verifyToken(token) : null
  const ua = req.headers.get("user-agent")
  const fwd = req.headers.get("x-forwarded-for")
  const currentSession = {
    device: describeDevice(ua),
    ip: fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip"),
    issuedAt: payload?.iat ? new Date(payload.iat * 1000).toISOString() : null,
    expiresAt: payload?.exp ? new Date(payload.exp * 1000).toISOString() : null,
  }

  const [logins, audit] = await Promise.all([
    prisma.loginAttempt.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, ip: true, success: true, createdAt: true },
    }).catch(() => []),
    prisma.activityLog.findMany({
      where: { userId: ctx.userId, action: { in: Array.from(SECURITY_ACTIONS) } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, meta: true, ip: true, userAgent: true, createdAt: true },
    }).catch(() => []),
  ])

  return NextResponse.json({
    authenticated: true,
    currentSession,
    logins: logins.map((l) => ({ ...l, device: null })),
    audit: audit.map((a) => ({
      id: a.id, action: a.action, ip: a.ip, device: describeDevice(a.userAgent),
      createdAt: a.createdAt,
    })),
    // Full multi-device session store + remote revoke is tracked infrastructure —
    // see docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md (Known Gaps, Module 5).
    sessionStore: { available: false, reason: "stateful-token-revocation-pending" },
  })
}
