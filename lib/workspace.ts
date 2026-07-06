import { prisma } from "@/lib/prisma"

export type Role = "owner" | "admin" | "member" | "viewer"
const WRITE_ROLES: Role[] = ["owner", "admin", "member"]

export interface WorkspaceContext {
  workspaceId: string
  role: Role
}

/**
 * Return the user's active workspace, provisioning one on first use.
 * (Sampker spec §2.1.1: a workspace is auto-created for every account.)
 */
export async function ensureWorkspace(userId: string): Promise<WorkspaceContext> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  })
  if (membership) return { workspaceId: membership.workspaceId, role: membership.role as Role }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
  const label = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "My"
  const ws = await prisma.workspace.create({
    data: {
      name: `${label}'s workspace`,
      ownerId: userId,
      members: { create: { userId, role: "owner" } },
    },
  })
  return { workspaceId: ws.id, role: "owner" }
}

export const canWrite = (role: Role) => WRITE_ROLES.includes(role)

/** Record an activity and bump the contact's lastActivityAt. */
export async function logActivity(opts: {
  workspaceId: string
  contactId: string
  actorId?: string | null
  type: string
  payload?: Record<string, unknown>
}) {
  await prisma.$transaction([
    prisma.activity.create({
      data: {
        workspaceId: opts.workspaceId,
        contactId: opts.contactId,
        actorId: opts.actorId ?? null,
        type: opts.type,
        payload: JSON.stringify(opts.payload ?? {}),
      },
    }),
    prisma.contact.update({ where: { id: opts.contactId }, data: { lastActivityAt: new Date() } }),
  ])
}
