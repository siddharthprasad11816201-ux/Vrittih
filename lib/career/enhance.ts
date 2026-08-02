/* ICIRE §15 — in-house résumé auto-enhancement. No LLM. Deterministic transforms
 * on the applicant's own content: strengthen weak/passive bullets, generate an
 * honest professional summary from real skills/experience, and tailor emphasis to
 * a target role. It NEVER invents metrics — a missing number becomes a clearly
 * marked fill-in placeholder for the candidate, not a fabricated figure. */
import type { SkillResult } from "./engine"
import { canonical } from "./taxonomy"

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s)
const hasNumber = (s: string) => /\b\d[\d,.]*\s*(%|k|m|bn|x|\+|hrs?|hours|users|customers|requests|ms|s|days|weeks|months|years|chf|usd|eur)?\b/i.test(s) || /%/.test(s)
const METRIC_HINT = " — [add a metric: %, time saved, scale, revenue]"

// Weak openers → a strong replacement verb (used only when we can't recover a
// better verb from the sentence itself).
const WEAK_MAP: [string, string][] = [
  ["was responsible for", "Led"], ["responsible for", "Led"], ["part of a team that", "Collaborated to"],
  ["worked on", "Built"], ["helped to", "Contributed to"], ["helped", "Contributed to"],
  ["assisted with", "Supported"], ["assisted", "Supported"], ["involved in", "Drove"],
  ["participated in", "Contributed to"], ["duties included", "Delivered"], ["tasked with", "Delivered"],
]
const IRREGULAR: Record<string, string> = { building: "Built", leading: "Led", running: "Ran", writing: "Wrote", making: "Made", setting: "Set", cutting: "Cut", holding: "Held", meeting: "Met", growing: "Grew", driving: "Drove", giving: "Gave", taking: "Took", rebuilding: "Rebuilt", overseeing: "Oversaw", spending: "Spent" }
// Content keyword → a fitting action verb, when a bullet opens with no verb at all.
const CONTENT_VERB: [RegExp, string][] = [
  [/\b(team|mentor|junior|hire|hiring|report)/i, "Led"],
  [/\b(api|service|feature|system|app|platform|website|tool|pipeline)/i, "Built"],
  [/\b(design|architecture|ux|ui)/i, "Designed"],
  [/\b(test|qa|coverage)/i, "Tested"],
  [/\b(data|report|analysis|dashboard|metric)/i, "Analyzed"],
  [/\b(migrat|upgrade|refactor)/i, "Migrated"],
  [/\b(deploy|ci|cd|infra|release)/i, "Automated"],
]

/** Turn a gerund ("maintaining") into a past-tense action verb ("Maintained"). */
function degerund(w: string): string | null {
  const lw = w.toLowerCase()
  if (IRREGULAR[lw]) return IRREGULAR[lw]
  if (!lw.endsWith("ing") || lw.length < 5) return null
  const base = lw.slice(0, -3)
  return cap(base + (base.endsWith("e") ? "d" : "ed"))
}

export type Rewrite = { original: string; improved: string; reason: string }

export function rewriteBullet(b: string): Rewrite | null {
  const raw = b.trim()
  if (raw.length < 6) return null
  const low = raw.toLowerCase()
  const STRONG = ["built", "designed", "led", "shipped", "launched", "implemented", "optimized", "optimised", "reduced", "increased", "improved", "architected", "automated", "delivered", "created", "developed", "migrated", "scaled", "drove", "owned", "spearheaded", "cut", "grew", "streamlined", "engineered", "deployed", "founded", "mentored", "negotiated", "maintained", "supported", "contributed", "collaborated", "analyzed", "tested"]
  const first = (low.match(/[a-z']+/)?.[0]) || ""
  const alreadyStrong = STRONG.includes(first)

  let improved = raw
  let reason = ""
  const weak = WEAK_MAP.find(([w]) => low.startsWith(w))
  if (weak) {
    const rest = raw.slice(weak[0].length).trim().replace(/^(the|a|an)\s+/i, "")
    const firstRest = (rest.match(/^[A-Za-z']+/)?.[0]) || ""
    const recovered = degerund(firstRest)
    improved = recovered ? recovered + rest.slice(firstRest.length) : `${weak[1]} ${lowerFirst(rest)}`
    reason = "Replaced a passive opener with a strong action verb"
  } else if (!alreadyStrong) {
    const cv = CONTENT_VERB.find(([re]) => re.test(raw))
    improved = `${cv ? cv[1] : "Delivered"} ${lowerFirst(raw)}`
    reason = "Led with a strong action verb"
  }

  if (!hasNumber(improved)) {
    improved = improved.replace(/[.\s]+$/, "") + METRIC_HINT
    reason = reason ? reason + " and flagged a missing metric" : "Flagged a missing measurable result"
  }
  if (improved.trim() === raw) return null
  return { original: raw, improved: cap(improved), reason }
}

const CAT_LABEL: Record<string, string> = { backend: "backend", frontend: "frontend", "data-ml": "data & ML", database: "data", devops: "DevOps", cloud: "cloud", mobile: "mobile", security: "security", design: "design", language: "software" }

/** An honest professional summary built only from the candidate's real skills and
 * measured experience — offered as an editable suggestion. */
export function generateSummary(skills: SkillResult[], years: number, headline?: string): { summary: string; note?: string } {
  const strong = skills.filter((s) => s.confidence >= 0.5).sort((a, b) => b.confidence - a.confidence)
  if (strong.length < 2) return { summary: "", note: "Add more skills and experience to your profile and we can draft a summary from real evidence." }
  const counts: Record<string, number> = {}
  for (const s of strong) if (s.category && s.category !== "soft") counts[s.category] = (counts[s.category] || 0) + 1
  const topCat = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const catLabel = (topCat && CAT_LABEL[topCat]) || "technology"
  const seniority = years >= 8 ? "Senior " : years >= 4 ? "Experienced " : ""
  // Highlight concrete skills, not umbrella/meta ones (Backend, Frontend…).
  const UMBRELLA = new Set(["Backend", "Frontend", "Database", "Problem Solving", "Software"])
  const concrete = strong.filter((s) => !UMBRELLA.has(s.skill))
  const pool = concrete.length >= 2 ? concrete : strong
  const top = pool.slice(0, 3).map((s) => s.skill)
  const next = pool.slice(3, 5).map((s) => s.skill)
  const yrs = years >= 2 ? ` with ${years}+ years' experience` : ""
  let summary = `${seniority}${catLabel} professional${yrs}, strong in ${list(top)}.`
  if (next.length) summary += ` Also skilled in ${list(next)}.`
  if (skills.some((s) => s.skill === "Leadership" && s.confidence >= 0.4)) summary += " Experienced leading and mentoring engineers."
  return { summary: cap(summary) }
}

function list(a: string[]): string {
  if (a.length <= 1) return a[0] || ""
  return a.slice(0, -1).join(", ") + " and " + a[a.length - 1]
}

/** Tailor the résumé to a specific role: which of the candidate's skills to lead
 * with, and which of their bullets are most relevant — pure reordering, no new
 * content. */
export function tailorForRole(bullets: string[], candidate: SkillResult[], targetSkills: string[]): { emphasizeSkills: string[]; leadBullets: string[]; note: string } {
  const targets = new Set(targetSkills.map((s) => (canonical(s) || s).toLowerCase()))
  const have = candidate.filter((s) => s.confidence >= 0.45 && targets.has(s.skill.toLowerCase())).sort((a, b) => b.confidence - a.confidence).map((s) => s.skill)
  const scored = bullets.map((b) => {
    const low = b.toLowerCase()
    let score = 0
    for (const t of targets) if (low.includes(t)) score++
    return { b, score }
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
  return {
    emphasizeSkills: have.slice(0, 6),
    leadBullets: scored.slice(0, 3).map((x) => x.b),
    note: have.length ? `Lead with ${list(have.slice(0, 3))} — this role screens for them.` : "This role's key skills aren't yet evident in your résumé — add them where true.",
  }
}

export type EnhanceResult = { rewrites: Rewrite[]; summary: string; summaryNote?: string; tailoring: { emphasizeSkills: string[]; leadBullets: string[]; note: string } }

export function enhanceResume(
  input: { bullets: string[]; bio?: string; headline?: string },
  candidate: SkillResult[],
  years: number,
  targetSkills: string[] = []
): EnhanceResult {
  const rewrites: Rewrite[] = []
  for (const b of input.bullets) {
    const r = rewriteBullet(b)
    if (r) rewrites.push(r)
    if (rewrites.length >= 6) break
  }
  const { summary, note } = generateSummary(candidate, years, input.headline)
  return { rewrites, summary, summaryNote: note, tailoring: tailorForRole(input.bullets, candidate, targetSkills) }
}
