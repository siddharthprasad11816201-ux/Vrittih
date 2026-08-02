/* ICIRE §19 — career-path simulator. Projects realistic next roles from the
 * candidate's current position along three tracks (IC, management, breadth). Each
 * step reuses the proven matchJob engine for HONEST skill gaps + prep, and binds
 * to REAL Job listings for CHF salary (shown only where CHF data exists — never
 * an estimate). No LLM. */
import { matchJob, type JobLike } from "./match"
import type { SkillResult } from "./engine"
import { familyForBucket, levelForBand, type RoleNode } from "./roles"
import { aggregateChf } from "./salary"

export type SimJob = { title?: string; skills?: string[]; salary?: string | null; industry?: string; description?: string }
export type SimStep = {
  role: string; level: number; track: string
  readinessNow: number
  addSkills: { skill: string; difficulty: string; prepDays: number }[]
  prepDays: number
  salary: string | null; salaryCount: number; jobsFound: number
}
export type SimTrack = { key: string; label: string; steps: SimStep[] }
export type CareerSimulation = {
  current: { family: string; label: string; level: number; title: string }
  tracks: SimTrack[]
  salaryNote: string
}

function stepFor(candidate: SkillResult[], node: RoleNode, track: string, jobs: SimJob[]): SimStep {
  const jobLike: JobLike = { title: node.title, skills: node.coreSkills }
  const m = matchJob(candidate, jobLike)
  const addSkills = m.missing.map((x) => ({ skill: x.skill, difficulty: x.difficulty, prepDays: x.prepDays })).slice(0, 6)
  const prepDays = addSkills.reduce((n, x) => n + x.prepDays, 0)
  const matchedJobs = jobs.filter((j) => node.titleKeywords.some((k) => (j.title || "").toLowerCase().includes(k)))
  const agg = aggregateChf(matchedJobs.map((j) => j.salary))
  return {
    role: node.title, level: node.level, track, readinessNow: m.overall,
    addSkills, prepDays,
    salary: agg ? agg.range.display : null, salaryCount: agg ? agg.count : 0, jobsFound: matchedJobs.length,
  }
}

export function simulateCareer(candidate: SkillResult[], opts: { bucket?: string; band?: string; jobs?: SimJob[] }): CareerSimulation {
  const fam = familyForBucket(opts.bucket)
  const curLevel = levelForBand(opts.band)
  const jobs = opts.jobs || []
  const curNode = [...fam.ic].reverse().find((n) => n.level <= curLevel) || fam.ic[0]

  const icSteps = fam.ic.filter((n) => n.level > curLevel).slice(0, 3).map((n) => stepFor(candidate, n, "ic", jobs))
  const mgmtSteps = fam.management.filter((n) => n.level >= Math.max(3, curLevel)).slice(0, 2).map((n) => stepFor(candidate, n, "management", jobs))
  const brSteps = fam.breadth.slice(0, 2).map((n) => stepFor(candidate, n, "breadth", jobs))

  const tracks: SimTrack[] = []
  if (icSteps.length) tracks.push({ key: "ic", label: `${fam.label} IC track`, steps: icSteps })
  if (mgmtSteps.length) tracks.push({ key: "management", label: "Management track", steps: mgmtSteps })
  if (brSteps.length) tracks.push({ key: "breadth", label: "Broaden your scope", steps: brSteps })

  return {
    current: { family: fam.key, label: fam.label, level: curLevel, title: curNode.title },
    tracks,
    salaryNote: "Salary shown only where real CHF listings exist — we never estimate or convert pay.",
  }
}
