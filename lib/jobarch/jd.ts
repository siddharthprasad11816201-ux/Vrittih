/* Job Architecture — in-house JD Assistant + competency libraries. PURE, testable.
 *
 * EROS Module 3 (Job Architecture). Generates a structured, well-formed job description
 * from a role's level, family, and required skills — DETERMINISTICALLY, with no external
 * LLM (patent goal). It is an honest template+taxonomy generator, not a language model:
 * it composes a summary, responsibilities scoped to seniority, must-have requirements
 * from the tagged skills, nice-to-haves from the implication graph, and the competency
 * set to interview against. Reuses lib/career/taxonomy (skill normalization + IMPLY) and
 * the role families in lib/career/roles.ts.
 */
import { canonical, categoryOf, IMPLY } from "@/lib/career/taxonomy"

export const LEVELS = [
  { key: "INTERN", label: "Intern", years: "0", scope: "learn the fundamentals under close guidance" },
  { key: "JUNIOR", label: "Junior", years: "0–2", scope: "deliver well-scoped tasks with mentorship" },
  { key: "MID", label: "Mid-level", years: "2–5", scope: "own features end-to-end with limited guidance" },
  { key: "SENIOR", label: "Senior", years: "5–8", scope: "lead complex projects and raise the team's bar" },
  { key: "LEAD", label: "Lead / Staff", years: "8+", scope: "set technical direction and multiply the team" },
  { key: "EXECUTIVE", label: "Executive", years: "12+", scope: "own strategy, outcomes, and org design" },
] as const
export type LevelKey = (typeof LEVELS)[number]["key"]
export function levelDef(key?: string) { return LEVELS.find(l => l.key === (key || "").toUpperCase()) || LEVELS[2] }

/* Competency library — the dimensions an interview panel evaluates. A base set applies
 * to all roles; families add role-specific ones. Keys line up with scorecard ratings. */
export const BASE_COMPETENCIES = [
  { key: "problem_solving", label: "Problem solving" },
  { key: "communication", label: "Communication" },
  { key: "ownership", label: "Ownership & delivery" },
  { key: "collaboration", label: "Collaboration" },
]
export const FAMILY_COMPETENCIES: Record<string, { key: string; label: string }[]> = {
  backend: [{ key: "system_design", label: "System design" }, { key: "code_quality", label: "Code quality & testing" }],
  frontend: [{ key: "ui_engineering", label: "UI engineering" }, { key: "accessibility", label: "Accessibility & UX sense" }],
  data: [{ key: "ml_depth", label: "ML / statistical depth" }, { key: "data_rigor", label: "Data rigour" }],
  infra: [{ key: "reliability", label: "Reliability & operations" }, { key: "automation", label: "Automation" }],
  mobile: [{ key: "mobile_craft", label: "Mobile craft" }, { key: "performance", label: "Performance" }],
  product: [{ key: "product_sense", label: "Product sense" }, { key: "prioritization", label: "Prioritisation" }],
  leadership: [{ key: "people_leadership", label: "People leadership" }, { key: "strategy", label: "Strategy" }],
}
export function competenciesFor(family?: string, level?: string): { key: string; label: string }[] {
  const out = [...BASE_COMPETENCIES]
  const fam = (family || "").toLowerCase()
  if (FAMILY_COMPETENCIES[fam]) out.push(...FAMILY_COMPETENCIES[fam])
  const lv = (level || "").toUpperCase()
  if (lv === "SENIOR" || lv === "LEAD" || lv === "EXECUTIVE") out.push({ key: "leadership", label: "Technical leadership / mentorship" })
  // dedupe by key
  const seen = new Set<string>()
  return out.filter(c => !seen.has(c.key) && seen.add(c.key))
}

export interface JDInput {
  title: string
  family?: string
  level?: string
  skills?: string[]
  responsibilities?: string[]   // extra, employer-supplied
  companyName?: string
  employmentType?: string       // Full-time | Contract | Internship ...
  remote?: boolean
}
export interface JD {
  title: string
  summary: string
  responsibilities: string[]
  requirements: string[]        // must-haves
  niceToHaves: string[]
  competencies: { key: string; label: string }[]
  markdown: string
  generatedBy: string           // honesty: names the deterministic generator
}

const RESP_BY_LEVEL: Record<string, string[]> = {
  INTERN: ["Complete guided projects that build core skills", "Ask questions and learn the team's tools and practices"],
  JUNIOR: ["Implement well-defined features with mentorship", "Write tests and respond to code review"],
  MID: ["Own features from design through delivery", "Improve quality, tests, and documentation", "Collaborate across functions to ship outcomes"],
  SENIOR: ["Lead the design and delivery of complex projects", "Mentor teammates and raise engineering standards", "Break down ambiguity into a clear plan"],
  LEAD: ["Set technical direction for a domain", "Multiply the team through mentorship and review", "Own cross-team architecture and trade-offs"],
  EXECUTIVE: ["Own strategy and outcomes for the function", "Build and develop the team and its structure", "Align execution with company objectives"],
}

function titleCase(s: string) { return s.replace(/\b\w/g, c => c.toUpperCase()) }
function uniq(a: string[]) { const s = new Set<string>(); return a.filter(x => x && !s.has(x.toLowerCase()) && s.add(x.toLowerCase())) }

export function generateJD(input: JDInput): JD {
  const lv = levelDef(input.level)
  const company = input.companyName?.trim()
  const skills = uniq((input.skills || []).map(s => canonical(s) || s).filter(Boolean))
  const empType = input.employmentType || "Full-time"

  const summary =
    `${company ? `${company} is hiring a ` : "We're hiring a "}${lv.label} ${input.title}` +
    `${input.remote ? " (remote-friendly)" : ""}. ` +
    `As a ${lv.label.toLowerCase()} on the team (${lv.years} years' experience), you'll ${lv.scope}` +
    `${skills.length ? `, working with ${skills.slice(0, 5).join(", ")}` : ""}.`

  const responsibilities = uniq([
    ...(RESP_BY_LEVEL[lv.key] || RESP_BY_LEVEL.MID),
    ...(input.responsibilities || []).map(r => String(r).trim()),
  ])

  // Must-haves: the tagged skills + a level-appropriate experience line.
  const requirements = uniq([
    `${lv.years} years of relevant experience`,
    ...skills.map(s => `Proficiency in ${s}`),
  ])

  // Nice-to-haves: skills implied by (but not identical to) the required ones.
  const implied = new Set<string>()
  for (const s of skills) {
    for (const key of Object.keys(IMPLY)) {
      if ((canonical(key) || key).toLowerCase() === s.toLowerCase()) {
        for (const im of IMPLY[key]) { const c = canonical(im) || im; if (!skills.some(k => k.toLowerCase() === c.toLowerCase())) implied.add(c) }
      }
    }
  }
  const niceToHaves = uniq(Array.from(implied)).slice(0, 6)

  const competencies = competenciesFor(input.family, input.level)

  const md = [
    `# ${titleCase(input.title)}${company ? ` — ${company}` : ""}`,
    ``, `**Level:** ${lv.label} · **Type:** ${empType}${input.remote ? " · Remote-friendly" : ""}`,
    ``, `## About the role`, summary,
    ``, `## What you'll do`, ...responsibilities.map(r => `- ${r}`),
    ``, `## What we're looking for`, ...requirements.map(r => `- ${r}`),
    ...(niceToHaves.length ? [``, `## Nice to have`, ...niceToHaves.map(r => `- ${r}`)] : []),
    ``, `## How we'll evaluate`, ...competencies.map(c => `- ${c.label}`),
  ].join("\n")

  return {
    title: titleCase(input.title), summary, responsibilities, requirements, niceToHaves, competencies,
    markdown: md, generatedBy: "in-house deterministic JD generator (template + skill-graph; no external LLM)",
  }
}
