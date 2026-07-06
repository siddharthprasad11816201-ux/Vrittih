import { NextRequest } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"

export interface AdminContext {
  userId: string
  role: string
}

/** Allows both ADMIN and SUPER_ADMIN. Returns null when the caller is neither. */
export function requireAdmin(req: NextRequest): AdminContext | null {
  const token = req.cookies.get("er_token")?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") return null
  return { userId: payload.userId, role: payload.role }
}

/** Restricts to SUPER_ADMIN only — for destructive / privilege-changing actions. */
export function requireSuperAdmin(req: NextRequest): AdminContext | null {
  const token = req.cookies.get("er_token")?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.role !== "SUPER_ADMIN") return null
  return { userId: payload.userId, role: payload.role }
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
