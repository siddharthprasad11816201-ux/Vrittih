import { NextRequest } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"

export interface AdminContext {
  userId: string
  role: string
}

/**
 * Resolve the caller's CURRENT privilege from the database.
 *
 * These used to trust the `role` claim inside the JWT. Because tokens live for 7 days,
 * demoting or BANNING an admin did not take effect until their token expired — a revoked
 * admin kept full access to every admin endpoint. Privilege is now re-read per request and
 * banned accounts are rejected outright.
 */
async function resolvePrivilege(req: NextRequest, allowed: string[]): Promise<AdminContext | null> {
  const token = req.cookies.get("er_token")?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  // Cheap pre-filter on the claim so a non-admin token costs no query.
  if (!allowed.includes(payload.role)) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, banned: true },
  }).catch(() => null)
  // Fail CLOSED: if we cannot confirm the privilege, we do not grant it.
  if (!user || user.banned || !allowed.includes(user.role)) return null
  return { userId: user.id, role: user.role }
}

/** Allows both ADMIN and SUPER_ADMIN. Returns null when the caller is neither. */
export async function requireAdmin(req: NextRequest): Promise<AdminContext | null> {
  return resolvePrivilege(req, ["ADMIN", "SUPER_ADMIN"])
}

/** Restricts to SUPER_ADMIN only — for destructive / privilege-changing actions. */
export async function requireSuperAdmin(req: NextRequest): Promise<AdminContext | null> {
  return resolvePrivilege(req, ["SUPER_ADMIN"])
}

/** Records an audited admin action. Never throws — auditing must not break the action. */
export async function logAction(
  actorId: string,
  action: string,
  meta?: unknown,
  req?: NextRequest
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: actorId,
        action,
        meta: meta === undefined ? null : JSON.stringify(meta),
        ip: req?.headers.get("x-forwarded-for") ?? null,
        userAgent: req?.headers.get("user-agent") ?? null,
      },
    })
  } catch {
    /* auditing is best-effort */
  }
}
