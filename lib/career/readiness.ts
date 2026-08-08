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

export interface Gap { skill: string; demand?: number; course?: { slug: string; title: string } | null }
export interface PlanItem { skill: string; priority: number; why: string; estWeeks: number; course: { slug: string; title: string } | null; actions: string[] }
export interface LearningPlan { items: PlanItem[]; totalWeeks: number; summary: string }

/* Evidence-based learning plan: gaps prioritised by REAL market demand (how often the skill
 * appears in the role's live postings), each linked to the ACTUAL Academy course when one
 * teaches it (honest "no course yet" otherwise), with a focused, front-loaded timeline.
 * Deterministic; no generic boilerplate — actions/why differ per skill by demand + resource. */
export function learningPlan(gaps: Gap[], targetRole: string, totalRoles = 0): LearningPlan {
  // Highest-demand gaps first; focus on the top 6 rather than an overwhelming list.
  const sorted = [...gaps].sort((a, b) => (b.demand || 0) - (a.demand || 0)).slice(0, 6)
  const items: PlanItem[] = sorted.map((g, i) => {
    const est = i < 2 ? 4 : i < 4 ? 3 : 2   // front-load the most in-demand skills
    const why = (g.demand && totalRoles)
      ? `Appears in ${g.demand} of ${totalRoles} live ${targetRole} posting${totalRoles > 1 ? "s" : ""} you'd compete for — not yet on your profile.`
      : `Commonly required for ${targetRole} and not yet on your profile.`
    const actions = g.course
      ? [`Start the Academy course “${g.course.title}”`, `Apply it in a portfolio project you can show recruiters`, `Finish with a mock interview focused on ${g.skill}`]
      : [`No Academy course covers ${g.skill} yet — build a portfolio project centred on it`, `Practise with real exercises and open-source contributions`, `Finish with a mock interview focused on ${g.skill}`]
    return { skill: g.skill, priority: i + 1, why, estWeeks: est, course: g.course || null, actions }
  })
  const n = items.length
  // Learned partly in parallel: ~4 weeks for the first, +2 per additional focused skill.
  const totalWeeks = n === 0 ? 0 : 4 + (n - 1) * 2
  const withCourse = items.filter(it => it.course).length
  const summary = n === 0
    ? "No skill gaps for this role — focus on depth, a flagship project and interview practice."
    : `Top ${n} gap${n > 1 ? "s" : ""} to close (by market demand) — ~${totalWeeks} weeks focused; ${withCourse} covered by an Academy course today.`
  return { items, totalWeeks, summary }
}
