/* ICIRE §14 — in-house résumé / ATS critique. No LLM. Heuristic analysis of the
 * applicant's bullets against a target role: weak verbs, missing quantification,
 * length, missing keywords (ATS), and section gaps — each with a concrete fix. */
import { canonical } from "./taxonomy"

const STRONG_VERBS = ["built", "designed", "led", "shipped", "launched", "implemented", "optimized", "optimised", "reduced", "increased", "improved", "architected", "automated", "delivered", "created", "developed", "migrated", "scaled", "drove", "owned", "spearheaded", "cut", "grew", "streamlined", "engineered", "deployed", "founded", "mentored", "negotiated"]
const WEAK_STARTS = ["responsible for", "worked on", "helped", "assisted", "involved in", "participated in", "duties included", "tasked with", "part of a team that"]

const hasNumber = (s: string) => /\b\d[\d,.]*\s*(%|k|m|bn|x|\+|hrs?|hours|users|customers|requests|ms|s|days|weeks|months|years|chf|usd|eur|₹|\$)?\b/i.test(s) || /%/.test(s)
const firstWord = (s: string) => (s.trim().toLowerCase().match(/[a-z']+/)?.[0] || "")

export type Finding = { severity: "high" | "medium" | "low"; type: string; message: string; fix: string; bullet?: string }
export type ResumeReview = {
  score: number
  stats: { bullets: number; quantified: number; strongVerbs: number; keywordCoverage: number }
  missingKeywords: string[]
  matchedKeywords: string[]
  findings: Finding[]
}

export function reviewResume(input: { bullets: string[]; bio?: string; headline?: string }, targetSkills: string[] = []): ResumeReview {
  const bullets = input.bullets.map((b) => b.trim()).filter((b) => b.length > 3)
  const findings: Finding[] = []
  let quantified = 0, strong = 0

  for (const b of bullets) {
    const low = b.toLowerCase()
    const weak = WEAK_STARTS.find((w) => low.startsWith(w))
    const strongLed = STRONG_VERBS.includes(firstWord(b))
    const quant = hasNumber(b)
    if (quant) quantified++
    if (strongLed) strong++
    if (weak) findings.push({ severity: "high", type: "weak-verb", message: `Bullet starts with "${weak}" — passive and low-impact.`, fix: `Lead with a strong action verb (Built, Led, Shipped, Reduced…) and state the outcome.`, bullet: b })
    else if (!strongLed) findings.push({ severity: "medium", type: "action-verb", message: "Bullet doesn't open with a strong action verb.", fix: "Start with a results verb: Built / Designed / Optimized / Delivered…", bullet: b })
    if (!quant) findings.push({ severity: "medium", type: "quantify", message: "No measurable impact.", fix: "Add a number — %, time saved, users, revenue, scale. E.g. “…cut load time 38%”.", bullet: b })
    if (b.length > 240) findings.push({ severity: "low", type: "length", message: "Bullet is long — recruiters skim.", fix: "Tighten to one line focused on impact.", bullet: b })
  }

  // ATS keyword coverage vs the target role.
  const text = " " + [input.headline, input.bio, ...bullets].filter(Boolean).join("  ").toLowerCase() + " "
  const canonTargets = [...new Set(targetSkills.map((s) => canonical(s) || s))]
  const matchedKeywords: string[] = [], missingKeywords: string[] = []
  for (const t of canonTargets) {
    const present = text.includes(" " + t.toLowerCase() + " ") || text.includes(t.toLowerCase())
    ;(present ? matchedKeywords : missingKeywords).push(t)
  }
  if (missingKeywords.length) findings.push({ severity: "high", type: "keywords", message: `Missing ${missingKeywords.length} keyword(s) this role screens for: ${missingKeywords.slice(0, 8).join(", ")}.`, fix: "Where true, weave these exact terms into your bullets and skills — ATS filters on them." })

  if (!input.headline) findings.push({ severity: "medium", type: "section", message: "No professional headline.", fix: "Add a one-line headline (role + focus) at the top." })
  if (!input.bio || input.bio.length < 40) findings.push({ severity: "low", type: "section", message: "Weak or missing summary.", fix: "Add a 2–3 line summary of your strengths and what you're targeting." })
  if (bullets.length < 3) findings.push({ severity: "medium", type: "content", message: "Very few experience/project bullets.", fix: "Add concrete bullets for each role/project — what you did and the result." })

  const kwCov = canonTargets.length ? matchedKeywords.length / canonTargets.length : 1
  const qRate = bullets.length ? quantified / bullets.length : 0
  const vRate = bullets.length ? strong / bullets.length : 0
  const sections = (input.headline ? 1 : 0) + (input.bio && input.bio.length >= 40 ? 1 : 0)
  const score = Math.round(100 * (0.34 * kwCov + 0.28 * qRate + 0.24 * vRate + 0.14 * (sections / 2)))

  const order = { high: 0, medium: 1, low: 2 } as const
  findings.sort((a, b) => order[a.severity] - order[b.severity])
  return { score, stats: { bullets: bullets.length, quantified, strongVerbs: strong, keywordCoverage: Math.round(kwCov * 100) }, missingKeywords, matchedKeywords, findings: findings.slice(0, 14) }
}
