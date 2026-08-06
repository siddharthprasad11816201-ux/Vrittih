/* Managed Placement — the Recruiter Copilot's fulfillment intelligence. PURE, testable.
 *
 * Per the EduRankAI Constitution: an employer states a requirement and the platform, acting
 * as a senior hiring manager, searches the talent pool and returns the best candidates WITH
 * EVIDENCE — why, missing competencies, risks, confidence, a salary band and an interview
 * plan. This module builds the evidence Brief for the Enterprise Brain (lib/intelligence/
 * deliberate) from a candidate's real signals vs the requirement, plus deterministic salary
 * and interview-plan reasoning. No external LLM; every output is explainable.
 */
import type { Brief } from "@/lib/intelligence/deliberate"

export const ROLE_TYPES = ["INTERN", "FULLTIME", "CONTRACT", "FREELANCE"] as const
export const PLACEMENT_STAGES = ["SOURCED", "SCREENED", "SHORTLISTED", "PRESENTED", "INTERVIEW", "OFFER", "PLACED", "REJECTED"] as const

export interface CandidateProfile {
  id: string; name: string
  skills: string[]
  years: number
  competencies?: { key: string; proficiency: number }[]
  remoteOk?: boolean
  location?: string
  headline?: string
}
export interface RequestSpec {
  title: string; roleType: string
  skills: string[]
  minYears: number
  seniority?: string | null
  remote: boolean
  location?: string | null
  budget?: number | null
  currency?: string
  softSkills?: string[]     // e.g. ["communication","system design","mentoring"]
}

export const normSkill = (s: string) => String(s || "").toLowerCase().replace(/[.\-_/]/g, " ").replace(/\s+/g, " ").trim()

export interface Overlap { matched: string[]; missing: string[]; coverage: number }
/* Case/format-insensitive required-skill coverage. */
export function skillOverlap(candidateSkills: string[], required: string[]): Overlap {
  const have = new Set(candidateSkills.map(normSkill).filter(Boolean))
  const req = required.map(s => ({ raw: s, n: normSkill(s) })).filter(s => s.n)
  const matched: string[] = [], missing: string[] = []
  for (const r of req) { if (have.has(r.n) || [...have].some(h => h.includes(r.n) || r.n.includes(h))) matched.push(r.raw); else missing.push(r.raw) }
  return { matched, missing, coverage: req.length ? +(matched.length / req.length).toFixed(3) : 0 }
}

/* Cheap 0..1 pre-screen score to shortlist candidates before the (heavier) deliberation. */
export function preScreenScore(c: CandidateProfile, r: RequestSpec): number {
  const ov = skillOverlap(c.skills, r.skills)
  const expFit = r.minYears > 0 ? Math.min(1, c.years / r.minYears) : 1
  const remoteFit = r.remote ? (c.remoteOk ? 1 : 0.7) : 1
  return +(0.65 * ov.coverage + 0.25 * expFit + 0.1 * remoteFit).toFixed(3)
}

/* Build the evidence Brief a senior hiring manager would weigh — fed to deliberate(). */
export function buildSuitabilityBrief(c: CandidateProfile, r: RequestSpec): Brief {
  const ov = skillOverlap(c.skills, r.skills)
  const evidence: Brief["evidence"] = []
  for (const s of ov.matched) evidence.push({ id: `sk+:${normSkill(s)}`, statement: `Has required skill: ${s}`, stance: "support", weight: 0.7, source: "skills" })
  for (const s of ov.missing) evidence.push({ id: `sk-:${normSkill(s)}`, statement: `Missing required skill: ${s}`, stance: "oppose", weight: 0.75, source: "skills" })
  // Experience vs the required minimum.
  if (r.minYears > 0) {
    if (c.years >= r.minYears) evidence.push({ id: "exp+", statement: `${c.years}y experience meets the ${r.minYears}y minimum`, stance: "support", weight: Math.min(0.9, 0.5 + (c.years - r.minYears) * 0.1), source: "experience" })
    else evidence.push({ id: "exp-", statement: `${c.years}y experience is below the ${r.minYears}y minimum`, stance: "oppose", weight: Math.min(0.9, 0.5 + (r.minYears - c.years) * 0.15), source: "experience" })
  }
  // Remote/location fit.
  if (r.remote && c.remoteOk === false) evidence.push({ id: "loc-", statement: "Not available for remote work", stance: "oppose", weight: 0.3, source: "preferences" })

  const criteria: Brief["criteria"] = [
    { key: "skill-match", label: "Required-skill coverage", weight: 0.55, score: ov.coverage },
    { key: "experience-fit", label: "Experience fit", weight: 0.3, score: r.minYears > 0 ? Math.min(1, c.years / r.minYears) : 0.8 },
    { key: "availability", label: "Availability fit", weight: 0.15, score: r.remote ? (c.remoteOk === false ? 0.4 : 1) : 1 },
  ]

  return {
    role: "senior hiring manager",
    question: `Should we advance ${c.name} for the ${r.title} (${r.roleType.toLowerCase()}) role?`,
    context: [`Requirement: ${r.title}`, `Required skills: ${r.skills.join(", ")}`, `Min experience: ${r.minYears}y`, r.remote ? "Remote" : (r.location || "On-site")].filter(Boolean),
    evidence,
    competency: c.competencies?.map(cp => ({ key: cp.key, proficiency: cp.proficiency, required: 0.6 })),
    criteria,
  }
}

export interface SalaryReco { currency: string; band: { min: number; max: number } | null; rationale: string }
/* Evidence-based salary band from the requirement budget, adjusted for experience fit.
 * Single-currency (the request's) — never mixes currencies. */
export function salaryRecommendation(r: RequestSpec, c: CandidateProfile): SalaryReco {
  const currency = (r.currency || "CHF").toUpperCase()
  if (!r.budget || r.budget <= 0) return { currency, band: null, rationale: "No budget provided — cannot recommend a band." }
  const top = r.budget
  const base = top * 0.8
  // Seniority within the band tracks experience relative to the minimum.
  const surplus = r.minYears > 0 ? Math.min(1, Math.max(-0.5, (c.years - r.minYears) / (r.minYears || 1))) : 0
  const min = Math.round(base * (1 + surplus * 0.1))
  const max = Math.round(Math.min(top, min * 1.15))
  return { currency, band: { min, max: Math.max(min, max) }, rationale: c.years >= r.minYears ? `Meets/exceeds the ${r.minYears}y bar — position in the upper half of the ${currency} budget.` : `Below the ${r.minYears}y bar — position in the lower half of the ${currency} budget.` }
}

export interface InterviewPlan { rounds: { name: string; focus: string }[]; panel: string[] }
/* Interview plan derived from the requirement + the candidate's gaps (missing skills get a
 * dedicated probing round). A senior interviewer's structure, not a static script. */
export function interviewPlan(r: RequestSpec, missing: string[]): InterviewPlan {
  const rounds: { name: string; focus: string }[] = [{ name: "Screening", focus: "Background, motivation, role fit" }]
  const soft = (r.softSkills || []).map(normSkill)
  if (r.skills.length) rounds.push({ name: "Technical", focus: `Core skills: ${r.skills.slice(0, 5).join(", ")}` })
  if (soft.includes("system design") || /senior|lead|principal|architect/i.test(r.seniority || "")) rounds.push({ name: "System design", focus: "Architecture, trade-offs, scalability" })
  if (missing.length) rounds.push({ name: "Gap probe", focus: `Verify depth on: ${missing.slice(0, 4).join(", ")}` })
  if (soft.includes("communication") || soft.includes("mentoring")) rounds.push({ name: "Behavioural", focus: "Communication, collaboration, mentoring" })
  const panel = ["Hiring manager", "Senior engineer in the domain"]
  if (rounds.some(r => r.name === "System design")) panel.push("Staff/architect for system design")
  if (soft.includes("mentoring")) panel.push("Team lead the hire would mentor")
  return { rounds, panel }
}
