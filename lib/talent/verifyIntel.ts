/* Spec §32 — Interview Verification Intelligence. In-house, deterministic (no LLM).
 * Given a candidate's CLAIMED skills, the skills DEMONSTRATED in their experience,
 * and the role's requirements, produce a recruiter-facing brief: strongest evidence,
 * listed-but-unverified claims, must-have gaps, honest risk signals, and verification
 * questions that PROBE claims (never trick). Pure → unit-tested. */
import { canonical, categoryOf, type Category } from "@/lib/career/taxonomy"

export type VerifyInput = {
  claimed: string[]
  demonstrated: string[]
  required?: { skill: string; must: boolean }[]
  seniority?: "Junior" | "Mid" | "Senior"
}
export type VerifyQuestion = { skill: string; question: string; purpose: "verify" | "depth" }
export type VerifyBrief = {
  strongest: string[]
  unverified: { skill: string; reason: string }[]
  gaps: string[]
  risks: string[]
  questions: VerifyQuestion[]
}

// Verification prompts by category — recruiter-probing (evidence-seeking), not practice.
const CATEGORY_Q: Record<Category, string> = {
  language: "walk through a non-trivial thing you built with it and a bug it caused",
  frontend: "describe a complex UI you built and how you measured its performance",
  backend: "describe a service you built with it and how it behaved under load",
  database: "describe a query or schema you optimized and how you found the bottleneck",
  cloud: "describe what you deployed on it and how you controlled cost and reliability",
  devops: "describe a pipeline or setup you own and what broke first at scale",
  "data-ml": "describe a model/analysis you shipped and how you evaluated it honestly",
  mobile: "describe an app you shipped and a platform-specific problem you solved",
  security: "describe a risk you found or mitigated and how you verified the fix",
  testing: "describe what you test, your coverage philosophy, and a bug tests caught",
  design: "walk through a design decision you made and how you validated it with users",
  domain: "describe the domain problem you solved and the constraints that shaped it",
  soft: "give a specific example (STAR) with a real, measurable outcome",
}
const safeCat = (s: string): Category => { try { return categoryOf(s) } catch { return "backend" } }
const questionFor = (skill: string) => `You list ${skill} — ${CATEGORY_Q[safeCat(skill)]}. Where exactly did you apply it, and how did you measure the result?`
const depthFor = (skill: string) => `Your experience shows ${skill}. ${CATEGORY_Q[safeCat(skill)]}?`

export function verificationBrief(input: VerifyInput): VerifyBrief {
  const canon = (s: string) => canonical(s) || s
  const claimed = new Set((input.claimed || []).map(canon).filter(Boolean))
  const demonstrated = new Set((input.demonstrated || []).map(canon).filter(Boolean))
  const required = (input.required || []).map((r) => ({ skill: canon(r.skill), must: r.must }))

  const strongest = [...demonstrated].slice(0, 8)
  const unverified = [...claimed].filter((s) => !demonstrated.has(s)).slice(0, 10)
    .map((skill) => ({ skill, reason: "Listed, but not evidenced in the experience/projects section." }))
  const mustReqs = required.filter((r) => r.must)
  const gaps = mustReqs.filter((r) => !claimed.has(r.skill) && !demonstrated.has(r.skill)).map((r) => r.skill).slice(0, 8)

  const risks: string[] = []
  if (claimed.size >= 12 && demonstrated.size <= 2) risks.push("Many skills listed but very few shown in real work — probe for genuine depth (possible keyword stuffing).")
  if (input.seniority === "Senior" && !claimed.has("Leadership") && !demonstrated.has("Leadership")) risks.push("Senior-level role but no leadership signal — probe ownership, mentoring and scope.")
  if (mustReqs.length && gaps.length >= Math.ceil(mustReqs.length / 2)) risks.push("Missing several must-have skills for this role — confirm whether transferable experience genuinely covers them.")

  const questions: VerifyQuestion[] = []
  for (const u of unverified.slice(0, 6)) questions.push({ skill: u.skill, purpose: "verify", question: questionFor(u.skill) })
  for (const s of strongest.slice(0, 2)) questions.push({ skill: s, purpose: "depth", question: depthFor(s) })
  return { strongest, unverified, gaps, risks, questions }
}
