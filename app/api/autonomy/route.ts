import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { GOALS, goalByKey } from "@/lib/autonomy/catalog"
import { planGoal, shapePlan } from "@/lib/autonomy/planner"

export const dynamic = "force-dynamic"

/* GET /api/autonomy — the caller's plans + the goal catalog. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const plans = await prisma.autonomousPlan.findMany({ where: { ownerId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 50 })
  return NextResponse.json({
    plans: plans.map(shapePlan),
    goals: GOALS.map(g => ({ key: g.key, title: g.title })),
  })
}

/* POST /api/autonomy — plan a goal into an ordered step sequence (in-house planner). */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const goal = goalByKey(String(b.goalKey || ""))
  if (!goal) return NextResponse.json({ error: "Unknown goal." }, { status: 400 })
  const built = planGoal(goal.key)
  if (!built || !built.feasible) return NextResponse.json({ error: built?.reason || "No feasible plan." }, { status: 400 })

  const created = await prisma.autonomousPlan.create({
    data: { ownerId: ctx.userId, goalKey: goal.key, goal: goal.title, status: "running", steps: JSON.stringify(built.steps) },
  })
  return NextResponse.json({ plan: shapePlan(created) }, { status: 201 })
}
