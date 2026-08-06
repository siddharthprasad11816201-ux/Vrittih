/* AI Career Coach — role readiness + learning plan. PURE, testable.
 *
 * The Constitution's Individual Experience: "I want to become X" -> evidence-based readiness,
 * gap analysis and a concrete learning plan. Builds the evidence Brief the Enterprise Brain
 * (lib/intelligence/deliberate) reasons over, from the candidate's REAL skills/experience vs
 * the role's REAL market-required skills (aggregated from live jobs by the provider). No
 * external LLM; every conclusion cites evidence. Reuses skillOverlap (no duplicated logic).
 */
import type { Brief } from "@/lib/intelligence/deliberate"
import { skillOverlap, normSkill } from "@/lib/recruitment/fulfillment"

export interface ReadinessInput {
  name: string
  candidateSkills: string[]
  years: number
  targetRole: string
  requiredSkills: string[]     // real market-required skills for the role
  minYears?: number            // typical experience for the role (from market)
}

/* "Is <name> ready for a <targetRole> role?" — support = readiness signals. */
export function buildReadinessBrief(i: ReadinessInput): Brief {
  const ov = skillOverlap(i.candidateSkills, i.requiredSkills)
  const minYears = i.minYears ?? 2
  const ev: Brief["evidence"] = []
  for (const s of ov.matched) ev.push({ id: `have:${normSkill(s)}`, statement: `Already has ${s}`, stance: "support", weight: 0.6, source: "skills" })
  for (const s of ov.missing) ev.push({ id: `gap:${normSkill(s)}`, statement: `Missing ${s} (required for ${i.targetRole})`, stance: "oppose", weight: 0.65, source: "gap" })
  if (i.years >= minYears) ev.push({ id: "exp", statement: `${i.years}y experience meets the ~${minYears}y typical for the role`, stance: "support", weight: 0.5, source: "experience" })
  else ev.push({ id: "exp-", statement: `${i.years}y experience vs ~${minYears}y typical`, stance: "oppose", weight: 0.4, source: "experience" })
  return {
    role: "senior career mentor",
    question: `Is ${i.name} ready for a ${i.targetRole} role?`,
    context: [`Target: ${i.targetRole}`, `Required: ${i.requiredSkills.join(", ") || "(no market data)"}`, `Has ${ov.matched.length}/${i.requiredSkills.length} required skills`],
    evidence: ev,
    criteria: [
      { key: "skills", label: "Skill coverage", weight: 0.65, score: ov.coverage },
      { key: "experience", label: "Experience", weight: 0.35, score: minYears > 0 ? Math.min(1, i.years / minYears) : 0.8 },
    ],
    reasoningThreshold: 0.12,
  }
}

export interface PlanItem { skill: string; why: string; estWeeks: number; actions: string[] }
export interface LearningPlan { items: PlanItem[]; totalWeeks: number; summary: string }

/* Deterministic learning plan to close the gap: per-skill actions + a realistic (parallel)
 * timeline estimate. */
export function learningPlan(missingSkills: string[], targetRole: string): LearningPlan {
  const items: PlanItem[] = missingSkills.map(s => ({
    skill: s,
    why: `Required for ${targetRole} and not yet on your profile.`,
    estWeeks: 4,
    actions: [`Take the Academy track for ${s}`, `Ship a portfolio project using ${s}`, `Complete practice exercises + a mock interview on ${s}`],
  }))
  // Skills are learned partly in parallel: first two ~4 weeks, each additional adds ~2.
  const n = items.length
  const totalWeeks = n === 0 ? 0 : n <= 2 ? n * 4 : 8 + (n - 2) * 2
  const summary = n === 0
    ? "No skill gaps for this role — focus on depth, projects and interview practice."
    : `${n} skill gap${n > 1 ? "s" : ""} to close — estimated ~${totalWeeks} weeks with focused, project-based learning.`
  return { items, totalWeeks, summary }
}
