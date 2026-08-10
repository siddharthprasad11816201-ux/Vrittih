/* ICIRE §21 — build the outcome calibration from REAL application results. This is
 * the "learn from what actually gets people hired" layer: it turns decided
 * applications (candidate skills × the job they applied to × the outcome) into the
 * CalRecord[] that calibration.ts learns from, then caches the Calibration.
 *
 * In-house, no LLM. It is honestly a no-op until enough real outcomes exist
 * (calibratedFunnel/feedbackSignals return null, weight factors stay 1.0) — so it
 * never fabricates signal from thin data. */
import { analyzeCareer } from "./engine"
import { matchJob, jobRequirements } from "./match"
import { buildCalibration, isDecided, reachedStage, type Calibration, type CalRecord } from "./calibration"

// One decided application, already shaped away from Prisma so this is unit-testable.
export type ShapedApp = {
  status: string
  jobId: string
  employerId: string
  candidateSkills: string[]
  candidateExperiences?: { title: string; company: string; description?: string }[]
  job: { title?: string; description?: string; industry?: string; skills?: string[] }
}

/** Pure: shaped decided applications -> calibration records (overall fit, advanced?,
 * which required skills the candidate actually held). Reuses the real match engine so
 * "overall" is exactly what candidates see. */
export function toCalRecords(apps: ShapedApp[]): CalRecord[] {
  const out: CalRecord[] = []
  for (const a of apps) {
    if (!isDecided(a.status)) continue
    const cand = analyzeCareer({ skills: a.candidateSkills, experiences: a.candidateExperiences }).skills
    const held = new Map(cand.map((s) => [s.skill, s.confidence]))
    const m = matchJob(cand, a.job)
    const skills = jobRequirements(a.job).map((r) => ({ skill: r.skill, covered: (held.get(r.skill) || 0) >= 0.4 }))
    out.push({ overall: m.overall, advanced: reachedStage(a.status) >= 2, skills, jobId: a.jobId, employerId: a.employerId })
  }
  return out
}

let cache: { cal: Calibration; at: number } | null = null
const TTL_MS = 15 * 60 * 1000

/** Build (and cache) the calibration from the live DB. Cheap enough at 15-min TTL;
 * returns an empty (no-op) calibration when there are no decided applications. */
export async function buildCalibrationFromDb(prisma: any, opts?: { force?: boolean; max?: number }): Promise<Calibration> {
  if (!opts?.force && cache && Date.now() - cache.at < TTL_MS) return cache.cal
  let records: CalRecord[] = []
  try {
    const apps = await prisma.application.findMany({
      take: opts?.max ?? 5000,
      select: {
        status: true, jobId: true,
        job: { select: { id: true, title: true, description: true, industry: true, postedById: true, company: true, skills: { include: { skill: true } } } },
        user: { select: { skills: { include: { skill: true } }, experience: { select: { title: true, company: true, description: true } } } },
      },
    })
    const shaped: ShapedApp[] = apps.filter((a: any) => a.job && a.user).map((a: any) => ({
      status: a.status,
      jobId: a.jobId,
      employerId: a.job.postedById || a.job.company || a.jobId,
      candidateSkills: (a.user.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
      candidateExperiences: (a.user.experience || []).map((e: any) => ({ title: e.title, company: e.company, description: e.description || undefined })),
      job: { title: a.job.title, description: a.job.description, industry: a.job.industry, skills: (a.job.skills || []).map((s: any) => s.skill?.name).filter(Boolean) },
    }))
    records = toCalRecords(shaped)
  } catch {
    records = []
  }
  const cal = buildCalibration(records)
  cache = { cal, at: Date.now() }
  return cal
}

export function clearCalibrationCache() { cache = null }
