import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"

export const dynamic = "force-dynamic"

/* GET /api/automation/runs — recent audited runs across the caller's rules. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const rules = await prisma.automationRule.findMany({ where: { ownerId: ctx.userId }, select: { id: true, name: true } })
  const nameById = new Map(rules.map(r => [r.id, r.name]))
  if (!rules.length) return NextResponse.json({ runs: [] })
  const runs = await prisma.automationRun.findMany({ where: { ruleId: { in: rules.map(r => r.id) } }, orderBy: { createdAt: "desc" }, take: 100 })
  return NextResponse.json({ runs: runs.map(r => ({ id: r.id, rule: nameById.get(r.ruleId) || "—", status: r.status, detail: r.detail, createdAt: r.createdAt })) })
}
