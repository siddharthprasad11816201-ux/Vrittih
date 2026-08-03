import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { bucketCounts, forecastSeries } from "@/lib/intelligence/forecast"

export const dynamic = "force-dynamic"
export const maxDuration = 60
const canPlan = (ctx: any) => ctx.has("pipeline.manage") || ctx.has("jobs.post") || ctx.has("ai.ops.view") || ctx.has("admin.access")
const MONTH = 30 * 864e5

/* EROS Module 1 — Strategic Workforce Planning feed. Forecasts hiring demand,
 * application volume and org growth from real series (in-house forecast engine), plus
 * skill demand and open-role load. Capability-gated. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canPlan(ctx)) return NextResponse.json({ error: "You need planning access." }, { status: 403 })
  const now = Date.now()
  const since = new Date(now - 12 * MONTH)

  const [hires, apps, users, jobSkills, openRoles, activeJobs, approvedTemplates] = await Promise.all([
    prisma.statusEvent.findMany({ where: { status: "HIRED", createdAt: { gte: since } }, select: { createdAt: true }, take: 20000 }).catch(() => [] as any[]),
    prisma.application.findMany({ where: { appliedAt: { gte: since } }, select: { appliedAt: true }, take: 20000 }).catch(() => [] as any[]),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true }, take: 20000 }),
    prisma.jobSkill.groupBy({ by: ["skillId"], _count: { _all: true }, orderBy: { _count: { skillId: "desc" } }, take: 12 }).catch(() => [] as any[]),
    prisma.jobTemplate.count({ where: { status: "APPROVED" } }).catch(() => 0),
    prisma.job.count({ where: { active: true } }),
    prisma.jobTemplate.count().catch(() => 0),
  ])

  const monthly = (ts: number[]) => bucketCounts(ts, MONTH, 12, now)
  const mk = (rows: any[], field: string) => {
    const pts = monthly(rows.map(r => +new Date(r[field])))
    return { points: pts, forecast: forecastSeries(pts, 3) }
  }
  const forecasts = {
    hires: mk(hires, "createdAt"),
    applications: mk(apps, "appliedAt"),
    growth: mk(users, "createdAt"),
  }

  // Skill demand — the most-required skills across the job catalogue.
  let skillDemand: { skill: string; count: number }[] = []
  if (jobSkills.length) {
    const skills = await prisma.skill.findMany({ where: { id: { in: jobSkills.map((g: any) => g.skillId) } }, select: { id: true, name: true } })
    const nameById = new Map(skills.map(s => [s.id, s.name]))
    skillDemand = jobSkills.map((g: any) => ({ skill: nameById.get(g.skillId) || "—", count: g._count?._all || 0 }))
  }

  return NextResponse.json({
    forecasts, skillDemand,
    stats: { openRoles, activeJobs, approvedTemplates, hires12mo: hires.length, applications12mo: apps.length, newUsers12mo: users.length },
    generatedAt: new Date(now).toISOString(),
  })
}
