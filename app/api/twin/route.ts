import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { computeOrgTwin } from "@/lib/twin/compute"

export const dynamic = "force-dynamic"

/* GET /api/twin — the caller's available twins: the org twin (live snapshot, if they
 * run a workforce), their projects (for project twins), and saved scenarios. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const [org, projects, scenarios] = await Promise.all([
    computeOrgTwin(ctx.userId).catch(() => null),
    prisma.project.findMany({ where: { OR: [{ ownerId: ctx.userId }, { employerId: ctx.userId }] }, select: { id: true, name: true, status: true }, orderBy: { updatedAt: "desc" }, take: 100 }).catch(() => [] as any[]),
    prisma.twinScenario.findMany({ where: { ownerId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 50 }).catch(() => [] as any[]),
  ])

  return NextResponse.json({
    org: org && org.headcount > 0 ? org : null,
    orgEmpty: !org || org.headcount === 0,
    projects,
    scenarios: scenarios.map((s: any) => ({ id: s.id, kind: s.kind, name: s.name, targetId: s.targetId, params: safe(s.params), result: safe(s.result), createdAt: s.createdAt })),
  })
}

function safe(s: string) { try { return JSON.parse(s || "{}") } catch { return {} } }
