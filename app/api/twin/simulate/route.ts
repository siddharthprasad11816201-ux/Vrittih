import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { computeOrgTwin, computeProjectTwin } from "@/lib/twin/compute"
import { simulateOrg, simulateProject } from "@/lib/twin/simulate"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/* POST /api/twin/simulate — recompute the live snapshot for {kind,targetId}, run the
 * what-if with {params}, and (if save) persist the scenario. Returns snapshot+result. */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const kind = String(b.kind || "")
  const params = b.params && typeof b.params === "object" ? b.params : {}

  let snapshot: any, result: any
  if (kind === "org") {
    snapshot = await computeOrgTwin(ctx.userId)
    if (!snapshot || snapshot.headcount === 0) return NextResponse.json({ error: "No workforce to model yet." }, { status: 400 })
    result = simulateOrg(snapshot, {
      hiresPerMonth: Number(params.hiresPerMonth) || 0,
      attritionRatePct: Number(params.attritionRatePct) || 0,
      months: Number(params.months) || 12,
      avgAnnualCostCHF: params.avgAnnualCostCHF ? Number(params.avgAnnualCostCHF) : undefined,
    })
  } else if (kind === "project") {
    const twin = await computeProjectTwin(String(b.targetId || ""), ctx.userId)
    if (!twin) return NextResponse.json({ error: "Project not found or not yours." }, { status: 404 })
    snapshot = twin.snapshot
    result = simulateProject(twin.snapshot, { addPeople: Number(params.addPeople) || 0, extraTasks: Number(params.extraTasks) || 0 })
  } else {
    return NextResponse.json({ error: "Unknown twin kind." }, { status: 400 })
  }

  let scenarioId: string | null = null
  if (b.save) {
    const name = String(b.name || "Scenario").slice(0, 120)
    const s = await prisma.twinScenario.create({
      data: { ownerId: ctx.userId, kind, targetId: kind === "project" ? String(b.targetId) : null, name, params: JSON.stringify(params).slice(0, 4000), result: JSON.stringify({ snapshot, result }).slice(0, 20000) },
    })
    scenarioId = s.id
  }

  return NextResponse.json({ snapshot, result, scenarioId })
}
