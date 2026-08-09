import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { advancePlan } from "@/lib/autonomy/execute"
import { shapePlan } from "@/lib/autonomy/planner"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/* POST /api/autonomy/[id]/approve — approve the current gated step, then continue
 * advancing the plan. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const p = await prisma.autonomousPlan.findUnique({ where: { id: params.id } })
  if (!p || p.ownerId !== ctx.userId) return NextResponse.json({ error: "Not your plan." }, { status: 403 })

  let steps: any[] = []; try { steps = JSON.parse(p.steps) } catch {}
  const gate = steps.find((s: any) => s.status === "awaiting_approval")
  if (!gate) return NextResponse.json({ error: "No step is awaiting approval." }, { status: 400 })
  gate.status = "approved"
  const res = await advancePlan(steps, ctx.userId, p.goal)
  const updated = await prisma.autonomousPlan.update({ where: { id: p.id }, data: { steps: JSON.stringify(res.steps), status: res.status } })
  return NextResponse.json({ plan: shapePlan(updated) })
}
