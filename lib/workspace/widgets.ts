/* Phase 1 · Module 7 — the Universal Widget Registry. Each widget declares its
 * required capability, size/group/order, and a data provider backed by REAL data
 * (career engine + DB). Adding a widget = one entry here; no dashboard code change.
 * Providers share a per-request memo so a composed workspace analyzes the profile
 * once. */
import { prisma } from "@/lib/prisma"
import { analyzeCareer } from "@/lib/career/engine"
import { rankJobs } from "@/lib/career/match"
import { computeCareerDNA } from "@/lib/career/dna"
import { computeFrontier } from "@/lib/career/frontier"
import { inputFromUser } from "@/lib/career/fromUser"
import type { WidgetSpec } from "./composer"

export type WidgetCtx = { subjectId: string; shared: Record<string, any> }
export type WidgetDef = WidgetSpec & { provider: (ctx: WidgetCtx) => Promise<any> }

async function analysisOf(ctx: WidgetCtx) {
  if (!ctx.shared.analysis) {
    const input = await inputFromUser(ctx.subjectId)
    ctx.shared.input = input
    ctx.shared.analysis = analyzeCareer(input)
  }
  return { analysis: ctx.shared.analysis, input: ctx.shared.input }
}
async function jobsOf(ctx: WidgetCtx) {
  if (!ctx.shared.jobs) {
    const jobs = await prisma.job.findMany({ where: { active: true }, select: { id: true, title: true, company: true, description: true, industry: true, createdAt: true, remote: true, skills: { include: { skill: true } } }, orderBy: { createdAt: "desc" }, take: 150 })
    ctx.shared.jobs = jobs.map((j) => ({ id: j.id, title: j.title, company: j.company, description: j.description, industry: j.industry, createdAt: j.createdAt, remote: j.remote, skills: (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean) }))
  }
  return ctx.shared.jobs as any[]
}

export const WIDGETS: WidgetDef[] = [
  {
    id: "ai-ops", title: "AI operations", description: "Platform intelligence health", capability: "ai.ops.view", size: "sm", group: "ai", order: 5,
    provider: async () => { const [runs, sem, ev] = await Promise.all([prisma.aiRun.count().catch(() => 0), prisma.semanticDoc.count().catch(() => 0), prisma.platformEvent.count().catch(() => 0)]); return { aiRuns: runs, indexedDocs: sem, events: ev } },
  },
  {
    id: "candidates", title: "Candidates", description: "Applicants to your roles", capability: "candidates.view", size: "sm", group: "recruit", order: 15,
    provider: async (ctx) => ({ total: await prisma.application.count({ where: { job: { postedById: ctx.subjectId } } }).catch(() => 0) }),
  },
  {
    id: "career-readiness", title: "Career readiness", description: "Your professional signal", capability: "career.intelligence", size: "md", group: "career", order: 10,
    provider: async (ctx) => {
      const { analysis, input } = await analysisOf(ctx)
      const dna = computeCareerDNA(analysis, { experienceMonths: (input.experiences || []).reduce((n: number, e: any) => n + (e.months || 0), 0), roleTitles: (input.experiences || []).map((e: any) => e.title).filter(Boolean) })
      return { archetype: dna.computed ? dna.archetype.label : null, seniority: dna.dimensions.find((d: any) => d.key === "seniority")?.band || null, skills: analysis.skills.length, demonstrated: analysis.skills.filter((s: any) => !s.implied).length }
    },
  },
  {
    id: "top-matches", title: "Best-fit roles", description: "Ranked by real fit", capability: "jobs.apply", size: "lg", group: "jobs", order: 20,
    provider: async (ctx) => { const { analysis } = await analysisOf(ctx); const ranked = rankJobs(analysis.skills, await jobsOf(ctx)).slice(0, 4); return { matches: ranked.map((r) => ({ id: r.job.id, title: r.job.title, company: (r.job as any).company, overall: r.match.overall })) } },
  },
  {
    id: "learn-next", title: "Learn next", description: "Highest-leverage skills", capability: "career.intelligence", size: "md", group: "career", order: 30,
    provider: async (ctx) => { const { analysis } = await analysisOf(ctx); const f = computeFrontier(analysis.skills, await jobsOf(ctx)); return { skills: f.learnNext.slice(0, 5).map((s) => ({ skill: s.skill, difficulty: s.difficulty })) } },
  },
  {
    id: "applications", title: "Your applications", description: "Live status", capability: "jobs.apply", size: "sm", group: "jobs", order: 40,
    provider: async (ctx) => { const g: any[] = await prisma.application.groupBy({ by: ["status"], where: { userId: ctx.subjectId }, _count: { status: true } }).catch(() => []); return { total: g.reduce((n, x) => n + x._count.status, 0), byStatus: g.map((x) => ({ status: x.status, count: x._count.status })) } },
  },
]

export const WIDGET_SPECS: WidgetSpec[] = WIDGETS.map(({ provider, ...s }) => s)
export const WIDGET_BY_ID = new Map(WIDGETS.map((w) => [w.id, w]))
