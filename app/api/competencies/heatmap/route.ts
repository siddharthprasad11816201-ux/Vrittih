import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { orgHeatmap } from "@/lib/learning/competency"

export const dynamic = "force-dynamic"
const canView = (ctx: any) => ctx.has("ai.ops.view") || ctx.has("admin.access") || ctx.has("hrms.view")

/* ELTOS Module 1/13 — Organization Capability heatmap: average proficiency per
 * competency across the population, weakest first (where to invest). Capability-gated. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canView(ctx)) return NextResponse.json({ error: "Executive/HR access required." }, { status: 403 })

  const [rows, comps, people] = await Promise.all([
    prisma.userCompetency.findMany({ select: { competencyKey: true, proficiency: true }, take: 50000 }),
    prisma.competency.findMany({ where: { published: true }, select: { key: true, label: true, kind: true } }),
    prisma.userCompetency.findMany({ distinct: ["userId"], select: { userId: true } }).then(r => r.length).catch(() => 0),
  ])
  const labelByKey = new Map(comps.map(c => [c.key, { label: c.label, kind: c.kind }]))
  const cells = orgHeatmap(rows).map(c => ({ ...c, label: labelByKey.get(c.key)?.label || c.key, kind: labelByKey.get(c.key)?.kind || "technical" }))
  return NextResponse.json({
    cells,
    stats: { competenciesMeasured: cells.length, peopleWithData: people, totalCompetencies: comps.length },
    note: cells.length === 0 ? "No competency evidence yet — the heatmap fills as people record proficiency / complete assessments." : undefined,
  })
}
