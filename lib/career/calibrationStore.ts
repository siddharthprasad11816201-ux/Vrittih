/* ICIRE §21 — calibration persistence + cohorts. Reads/writes MatchCalibration,
 * with a short in-process cache. Recompute runs over Application.snapshot in
 * cron/admin only (heavy). All aggregate + PII-free. */
import { prisma } from "@/lib/prisma"
import { analyzeCareer } from "@/lib/career/engine"
import { matchJob, jobRequirements, type JobLike } from "@/lib/career/match"
import { inputFromSnapshot } from "@/lib/career/fromUser"
import { categoryOf } from "@/lib/career/taxonomy"
import { buildCalibration, reachedStage, isDecided, type Calibration, type CalRecord } from "@/lib/career/calibration"

const FAMILY: Record<string, string> = { frontend: "frontend", design: "frontend", backend: "backend", database: "backend", "data-ml": "data", cloud: "infra", devops: "infra", mobile: "mobile", security: "security", testing: "quality" }

/** The cohort a job belongs to, from the dominant family of its skills. */
export function familyOf(skills: string[]): string {
  const counts: Record<string, number> = {}
  for (const s of skills) { const f = FAMILY[categoryOf(s)]; if (f) counts[f] = (counts[f] || 0) + 1 }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
  return top ? `family:${top}` : "global"
}

const cache = new Map<string, { cal: Calibration; at: number }>()
const TTL = 5 * 60 * 1000

export async function getCalibration(cohort: string): Promise<Calibration | null> {
  const hit = cache.get(cohort)
  if (hit && Date.now() - hit.at < TTL) return hit.cal
  let row: any = null
  try { row = await prisma.matchCalibration.findUnique({ where: { cohort } }) } catch { return null }
  if (!row) return null
  const cal: Calibration = {
    buckets: safe(row.buckets, []), skills: safe(row.skills, {}),
    baseAdvRate: row.baseAdvRate, sampleSize: row.sampleSize, jobCount: row.jobCount, employerCount: row.employerCount,
  }
  cache.set(cohort, { cal, at: Date.now() })
  return cal
}

export type RecomputeSummary = { cohorts: { cohort: string; sampleSize: number; jobCount: number; employerCount: number }[]; scanned: number; decided: number }

/** Recompute all cohort calibrations from decided applications. Heavy — cron/admin
 * only. Never stores identity: only score buckets + per-skill advancement counts. */
export async function recomputeCalibration(limit = 4000): Promise<RecomputeSummary> {
  const apps = await prisma.application.findMany({
    where: { snapshot: { not: null } },
    select: { status: true, snapshot: true, jobId: true, job: { select: { postedById: true, title: true, description: true, industry: true, skills: { include: { skill: true } } } } },
    take: limit,
    orderBy: { id: "desc" },
  })

  const byCohort: Record<string, CalRecord[]> = { global: [] }
  let decided = 0
  for (const a of apps) {
    if (!a.job || !isDecided(a.status)) continue
    decided++
    const jobSkills = (a.job.skills || []).map((s: any) => s.skill?.name).filter(Boolean)
    const jobLike: JobLike = { title: a.job.title, description: a.job.description, industry: a.job.industry, skills: jobSkills }
    const cand = analyzeCareer(inputFromSnapshot(a.snapshot)).skills
    const m = matchJob(cand, jobLike)
    const confOf = new Map(cand.map((s) => [s.skill, s.confidence]))
    const req = jobRequirements(jobLike)
    const skills = req.map((r) => ({ skill: r.skill, covered: (confOf.get(r.skill) ?? 0) >= 0.4 }))
    const rec: CalRecord = { overall: m.overall, advanced: reachedStage(a.status) >= 2, skills, jobId: a.jobId, employerId: a.job.postedById || "unknown" }
    byCohort.global.push(rec)
    const fam = familyOf(jobSkills)
    if (fam !== "global") (byCohort[fam] ||= []).push(rec)
  }

  const summary: RecomputeSummary = { cohorts: [], scanned: apps.length, decided }
  for (const [cohort, recs] of Object.entries(byCohort)) {
    if (!recs.length) continue
    const cal = buildCalibration(recs)
    await prisma.matchCalibration.upsert({
      where: { cohort },
      update: { buckets: JSON.stringify(cal.buckets), skills: JSON.stringify(cal.skills), baseAdvRate: cal.baseAdvRate, sampleSize: cal.sampleSize, jobCount: cal.jobCount, employerCount: cal.employerCount, computedAt: new Date() },
      create: { cohort, buckets: JSON.stringify(cal.buckets), skills: JSON.stringify(cal.skills), baseAdvRate: cal.baseAdvRate, sampleSize: cal.sampleSize, jobCount: cal.jobCount, employerCount: cal.employerCount },
    })
    cache.delete(cohort)
    summary.cohorts.push({ cohort, sampleSize: cal.sampleSize, jobCount: cal.jobCount, employerCount: cal.employerCount })
  }
  return summary
}

function safe<T>(s: string, fb: T): T { try { return JSON.parse(s) } catch { return fb } }
