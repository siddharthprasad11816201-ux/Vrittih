/**
 * ONE definition of administrative authority, shared by every admin surface.
 *
 * Before this, each admin route re-implemented its own check — read the cookie, verify the
 * token, compare the role claim — which meant the semantics drifted per file and a fix in
 * one place did not reach the others. Worst of all, most read the role from the JWT, so a
 * demoted or banned admin kept their powers until the 7-day token expired.
 *
 * Every rule lives here now:
 *   - privilege is re-read from the DATABASE on each request,
 *   - banned accounts are refused outright,
 *   - it fails CLOSED (an unreadable user is not an admin),
 *   - destructive actions require SUPER_ADMIN,
 *   - and the capability set handed to the UI is computed from the SAME source, so the
 *     client can never render an action the API would refuse.
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { logAction } from "@/lib/admin"

export interface Authority {
  userId: string
  /** The CURRENT role from the database, not the one baked into the token. */
  role: string
  isAdmin: boolean
  isSuperAdmin: boolean
}

/** Capabilities safe to hand to a client so it can render the right controls. */
export interface ViewerCapabilities {
  isAdmin: boolean
  /** Permanent, cascading deletion. Super admin only. */
  canDelete: boolean
  /** Edit and archive/restore. */
  canEdit: boolean
}

export const NO_AUTHORITY: ViewerCapabilities = { isAdmin: false, canDelete: false, canEdit: false }

/**
 * Resolve the caller's administrative authority, or null if they have none.
 * Cheap for ordinary users: a non-admin token is rejected before any query runs.
 */
export async function adminAuthority(req: NextRequest): Promise<Authority | null> {
  const token = req.cookies.get("er_token")?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  // Pre-filter on the claim so a job seeker's request costs no database round trip.
  if (!["ADMIN", "SUPER_ADMIN"].includes(payload.role)) return null

  const user = await prisma.user
    .findUnique({ where: { id: payload.userId }, select: { id: true, role: true, banned: true } })
    .catch(() => null)
  // Fail closed: if the privilege cannot be confirmed, it is not granted.
  if (!user || user.banned || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return null

  return {
    userId: user.id,
    role: user.role,
    isAdmin: true,
    isSuperAdmin: user.role === "SUPER_ADMIN",
  }
}

/** What the current caller may do. Safe to serialise to the client. */
export async function viewerCapabilities(req: NextRequest): Promise<ViewerCapabilities> {
  const a = await adminAuthority(req)
  if (!a) return NO_AUTHORITY
  return { isAdmin: true, canEdit: true, canDelete: a.isSuperAdmin }
}

export type AuthorityResult =
  | { ok: true; authority: Authority }
  | { ok: false; response: NextResponse }

/**
 * Guard for an admin route.
 *
 *   const gate = await requireAuthority(req, { destructive: true })
 *   if (!gate.ok) return gate.response
 *   const admin = gate.authority
 *
 * Deliberately an explicit result rather than "returns Authority | NextResponse, check with
 * instanceof". An instanceof test silently returns FALSE when the class comes from a
 * different module realm, which would let an error response flow onward as though it were a
 * granted authority — failing OPEN. A discriminated union cannot fail that way.
 */
export async function requireAuthority(
  req: NextRequest,
  opts: { destructive?: boolean } = {},
): Promise<AuthorityResult> {
  const a = await adminAuthority(req)
  if (!a) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) }
  if (opts.destructive && !a.isSuperAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Only a super admin can permanently delete. Archive it instead — that is reversible." },
        { status: 403 },
      ),
    }
  }
  return { ok: true, authority: a }
}

/**
 * Diff two records for the audit trail.
 *
 * An audit line that cannot answer "what was it before?" is close to useless during an
 * incident, so every change records both values. Long text is truncated — the trail should
 * say a description changed, not carry a copy of it.
 */
export function diffRecords(before: any, after: any, fields: readonly string[]): Record<string, { from: any; to: any }> {
  const clip = (v: any) => (typeof v === "string" && v.length > 120 ? v.slice(0, 120) + "…" : v)
  const changes: Record<string, { from: any; to: any }> = {}
  for (const f of fields) {
    if (before?.[f] !== after?.[f]) changes[f] = { from: clip(before?.[f]), to: clip(after?.[f]) }
  }
  return changes
}

/** Record an administrative action. Never throws — auditing must not break the action. */
export async function auditAdmin(
  a: Authority,
  action: string,
  meta: Record<string, any>,
  req: NextRequest,
): Promise<void> {
  await logAction(a.userId, action, meta, req)
}

/**
 * Coerce client input into an update object, keeping only allowed fields.
 * An empty string clears a nullable field; whitespace-only is treated as empty.
 */
export function pickFields(body: any, fields: readonly string[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const f of fields) {
    if (body?.[f] === undefined) continue
    const v = body[f]
    out[f] = typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v
  }
  return out
}
