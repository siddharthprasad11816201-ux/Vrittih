/* ICIRE core engine — in-house, no external NLP/LLM. Turns an applicant's
 * signals (headline, bio, skills, projects, experience, education, documents)
 * into: detected skills (explicit + IMPLIED, §4), evidence-based proficiency
 * (§5), and a professional knowledge graph (§3). Pure functions — fully testable.
 */
import { SKILLS, IMPLY, canonical, categoryOf, allAliases, normalizeText as norm, type Category } from "./taxonomy"

export type SignalKind = "headline" | "bio" | "skill" | "project" | "experience" | "education" | "certificate" | "document"
export type Signal = { kind: SignalKind; text: string; months?: number; ageYears?: number }

type Ev = {
  explicit: boolean          // listed as a skill or named in a heading
  projects: number           // # of project signals mentioning it
  experienceMonths: number   // months across experience signals mentioning it
  mentions: number           // total signals mentioning it
  minAgeYears: number        // most-recent usage (years ago)
  impliedOnly: boolean       // reached only via implication
  sources: Set<SignalKind>
}

export type SkillResult = {
  skill: string
  category: Category
  confidence: number         // 0..1
  level: "Novice" | "Familiar" | "Proficient" | "Advanced" | "Expert"
  implied: boolean
  scores: { claim: number; projectDepth: number; experience: number; frequency: number; recency: number }
  evidence: { explicit: boolean; projects: number; experienceMonths: number; mentions: number; recencyYears: number | null; sources: SignalKind[] }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const r2 = (n: number) => Math.round(n * 100) / 100

function levelFor(c: number): SkillResult["level"] {
  if (c >= 0.85) return "Expert"
  if (c >= 0.68) return "Advanced"
  if (c >= 0.5) return "Proficient"
  if (c >= 0.3) return "Familiar"
  return "Novice"
}

// Which skills / implication-keys does one signal's text contain?
function detect(text: string): { direct: string[]; phrases: string[] } {
  const t = " " + norm(text) + " "
  const tokens = new Set(norm(text).split(/[^a-z0-9+#]+/).filter(Boolean))
  const has = (alias: string) => {
    const a = norm(alias)
    return a.includes(" ") ? t.includes(" " + a + " ") : tokens.has(a)
  }
  const direct = new Set<string>()
  for (const { alias, canon } of allAliases()) if (has(alias)) direct.add(canon)
  const phrases: string[] = []
  for (const key of Object.keys(IMPLY)) {
    if (SKILLS[key]) continue // skill-keys handled via closure, not text
    if (has(key)) phrases.push(key)
  }
  return { direct: [...direct], phrases }
}

/** Detect skills (explicit + implied) with evidence, from a list of signals. */
export function extract(signals: Signal[]): Map<string, Ev> {
  const ev = new Map<string, Ev>()
  const touch = (skill: string, s: Signal, explicit: boolean, implied: boolean) => {
    let e = ev.get(skill)
    if (!e) { e = { explicit: false, projects: 0, experienceMonths: 0, mentions: 0, minAgeYears: Infinity, impliedOnly: true, sources: new Set() }; ev.set(skill, e) }
    e.mentions++
    e.sources.add(s.kind)
    if (explicit) e.explicit = true
    if (!implied) e.impliedOnly = false
    if (s.kind === "project") e.projects++
    if (s.kind === "experience") e.experienceMonths += s.months || 6
    if (typeof s.ageYears === "number") e.minAgeYears = Math.min(e.minAgeYears, s.ageYears)
    else e.minAgeYears = Math.min(e.minAgeYears, 0)
  }

  for (const s of signals) {
    const { direct, phrases } = detect(s.text)
    // explicit if the whole signal IS the skill (a listed skill) or it's a heading mention
    for (const skill of direct) touch(skill, s, s.kind === "skill", false)
    // domain/phrase implications from raw text
    const implied = new Set<string>()
    for (const p of phrases) for (const imp of IMPLY[p] || []) implied.add(canonical(imp) || imp)
    // skill->skill implication closure (bounded 2 hops)
    let frontier = [...direct]
    for (let hop = 0; hop < 2 && frontier.length; hop++) {
      const next: string[] = []
      for (const sk of frontier) for (const imp of IMPLY[sk] || []) { const c = canonical(imp) || imp; if (!implied.has(c) && !direct.includes(c)) { implied.add(c); next.push(c) } }
      frontier = next
    }
    for (const skill of implied) if (!direct.includes(skill)) touch(skill, s, false, true)
  }
  return ev
}

function score(e: Ev): SkillResult["scores"] & { confidence: number } {
  const claim = e.explicit ? 1 : e.projects > 0 ? 0.6 : e.impliedOnly ? 0.3 : 0.45
  const projectDepth = clamp01(e.projects / 4)
  const experience = clamp01(e.experienceMonths / 24)
  const frequency = clamp01(e.mentions / 6)
  const recency = e.minAgeYears === Infinity ? 0.5 : clamp01(1 - e.minAgeYears / 5)
  let confidence = 0.30 * claim + 0.28 * projectDepth + 0.22 * experience + 0.10 * frequency + 0.10 * recency
  // Implied-only skills are hypotheses, not demonstrated mastery — cap them.
  if (e.impliedOnly) confidence = Math.min(confidence, 0.45)
  // A bare explicit claim with no evidence shouldn't read as mastery.
  if (e.explicit && e.projects === 0 && e.experienceMonths === 0 && e.mentions <= 1) confidence = Math.min(confidence, 0.5)
  return { claim: r2(claim), projectDepth: r2(projectDepth), experience: r2(experience), frequency: r2(frequency), recency: r2(recency), confidence: r2(clamp01(confidence)) }
}

export function proficiencies(ev: Map<string, Ev>): SkillResult[] {
  const out: SkillResult[] = []
  for (const [skill, e] of ev) {
    const s = score(e)
    out.push({
      skill, category: categoryOf(skill), confidence: s.confidence, level: levelFor(s.confidence), implied: e.impliedOnly,
      scores: { claim: s.claim, projectDepth: s.projectDepth, experience: s.experience, frequency: s.frequency, recency: s.recency },
      evidence: { explicit: e.explicit, projects: e.projects, experienceMonths: e.experienceMonths, mentions: e.mentions, recencyYears: e.minAgeYears === Infinity ? null : e.minAgeYears, sources: [...e.sources] },
    })
  }
  return out.sort((a, b) => b.confidence - a.confidence)
}

export type CareerGraph = {
  nodes: { id: string; type: string; label: string; meta?: any }[]
  edges: { from: string; to: string; rel: string }[]
}

function buildGraph(skills: SkillResult[], input: AnalyzeInput): CareerGraph {
  const nodes: CareerGraph["nodes"] = [{ id: "me", type: "applicant", label: input.name || "You" }]
  const edges: CareerGraph["edges"] = []
  const catSeen = new Set<string>()
  for (const s of skills) {
    const sid = "skill:" + s.skill
    nodes.push({ id: sid, type: "skill", label: s.skill, meta: { category: s.category, confidence: s.confidence, level: s.level, implied: s.implied } })
    edges.push({ from: "me", to: sid, rel: s.implied ? "may-know" : "knows" })
    const cid = "cat:" + s.category
    if (!catSeen.has(cid)) { catSeen.add(cid); nodes.push({ id: cid, type: "category", label: s.category }) }
    edges.push({ from: sid, to: cid, rel: "in" })
  }
  for (const ex of input.experiences || []) {
    const id = "exp:" + norm(ex.company + ex.title).replace(/\s+/g, "-")
    nodes.push({ id, type: "experience", label: `${ex.title} · ${ex.company}`, meta: { months: ex.months } })
    edges.push({ from: "me", to: id, rel: "worked" })
  }
  for (const ed of input.education || []) {
    const id = "edu:" + norm(ed.school).replace(/\s+/g, "-")
    nodes.push({ id, type: "education", label: ed.degree ? `${ed.degree} · ${ed.school}` : ed.school })
    edges.push({ from: "me", to: id, rel: "studied" })
  }
  return { nodes, edges }
}

export type AnalyzeInput = {
  name?: string
  headline?: string
  bio?: string
  skills?: string[]
  projects?: { title?: string; description?: string }[]
  experiences?: { title: string; company: string; description?: string; months?: number; ageYears?: number }[]
  education?: { school: string; degree?: string; field?: string }[]
  documents?: { kind?: SignalKind; text: string }[]
}

export function signalsFrom(input: AnalyzeInput): Signal[] {
  const s: Signal[] = []
  if (input.headline) s.push({ kind: "headline", text: input.headline })
  if (input.bio) s.push({ kind: "bio", text: input.bio })
  for (const sk of input.skills || []) s.push({ kind: "skill", text: sk })
  for (const p of input.projects || []) s.push({ kind: "project", text: [p.title, p.description].filter(Boolean).join(". ") })
  for (const e of input.experiences || []) s.push({ kind: "experience", text: [e.title, e.company, e.description].filter(Boolean).join(". "), months: e.months, ageYears: e.ageYears })
  for (const e of input.education || []) s.push({ kind: "education", text: [e.degree, e.field, e.school].filter(Boolean).join(". ") })
  for (const d of input.documents || []) s.push({ kind: d.kind || "document", text: d.text })
  return s
}

export type CareerAnalysis = {
  skills: SkillResult[]
  graph: CareerGraph
  summary: {
    totalSkills: number; explicit: number; implied: number
    byCategory: Record<string, number>
    topSkills: { skill: string; confidence: number; level: string }[]
    strengths: Category[]
    growthAreas: { skill: string; confidence: number; reason: string }[]
  }
}

/** Full analysis: input -> skills (w/ proficiency) + knowledge graph + summary. */
export function analyzeCareer(input: AnalyzeInput): CareerAnalysis {
  const skills = proficiencies(extract(signalsFrom(input)))
  const byCategory: Record<string, number> = {}
  const catConf: Record<string, number> = {}
  for (const s of skills) { byCategory[s.category] = (byCategory[s.category] || 0) + 1; catConf[s.category] = (catConf[s.category] || 0) + s.confidence }
  const strengths = (Object.entries(catConf).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c)) as Category[]
  // Growth areas: skills present but weak (implied-only or low confidence) — where a little work moves the needle.
  const growthAreas = skills
    .filter((s) => s.confidence < 0.5 && s.category !== "soft")
    .slice(0, 6)
    .map((s) => ({ skill: s.skill, confidence: s.confidence, reason: s.implied ? "Inferred from your work but not demonstrated directly" : "Detected but with limited evidence" }))
  return {
    skills,
    graph: buildGraph(skills, input),
    summary: {
      totalSkills: skills.length,
      explicit: skills.filter((s) => !s.implied).length,
      implied: skills.filter((s) => s.implied).length,
      byCategory, strengths,
      topSkills: skills.slice(0, 8).map((s) => ({ skill: s.skill, confidence: s.confidence, level: s.level })),
      growthAreas,
    },
  }
}
