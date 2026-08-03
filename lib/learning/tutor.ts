/* In-house AI Tutor — deterministic, explainable core. PURE, testable.
 *
 * ELTOS Module 5. NO external LLM. The tutor classifies what the learner needs and
 * structures a response from the shared skill graph + the curated resource engine + the
 * learner's own gap: study plans, practice sets, quiz outlines, concept maps and
 * recommendations. It never fabricates factual answers — for "explain" it points to
 * authoritative resources (retrieval happens in the AIOS provider); quizzes are honest
 * question *templates*, not auto-generated Q&A. Runs through AIOS execute() (audited).
 */
import { categoryOf } from "@/lib/career/taxonomy"
import { resourcesFor, projectIdea, type Resource } from "@/lib/career/resources"

export type TutorIntent = "explain" | "plan" | "practice" | "quiz" | "recommend" | "guidance"

/* Lightweight deterministic intent classification (keyword rules — no model). */
export function classifyTutorIntent(qRaw: string): TutorIntent {
  const q = (qRaw || "").toLowerCase()
  if (/\b(plan|schedule|roadmap|how long|timeline|study plan|prepare)\b/.test(q)) return "plan"
  if (/\b(quiz|test me|questions|assessment|mock)\b/.test(q)) return "quiz"
  if (/\b(practice|exercise|problem|drill|project to build)\b/.test(q)) return "practice"
  if (/\b(recommend|resource|course|book|where.*learn|what should i)\b/.test(q)) return "recommend"
  if (/\b(what is|explain|how does|define|understand|concept|difference between)\b/.test(q)) return "explain"
  return "guidance"
}

export interface StudySession { day: number; skill: string; activity: string; minutes: number }
const ACTIVITY_CYCLE = ["Learn the fundamentals", "Practice with exercises", "Apply in a mini-project", "Review & self-quiz"]

/* A deterministic study plan: distribute focus skills across the available days,
 * cycling through learn → practice → apply → review. */
export function studyPlan(skills: string[], days: number, minutesPerDay = 60): StudySession[] {
  const focus = skills.filter(Boolean)
  const n = Math.max(1, Math.round(days))
  if (!focus.length) return []
  const sessions: StudySession[] = []
  const perSkill: Record<string, number> = {}
  for (let d = 1; d <= n; d++) {
    const skill = focus[(d - 1) % focus.length]
    const occ = perSkill[skill] = (perSkill[skill] || 0) + 1
    sessions.push({ day: d, skill, activity: ACTIVITY_CYCLE[(occ - 1) % ACTIVITY_CYCLE.length], minutes: Math.max(15, Math.min(240, Math.round(minutesPerDay))) })
  }
  return sessions
}

/* A practice set for a skill — reuses the curated resource engine (exercises + a build
 * project), so recommendations are real links, never invented. */
export function practiceSet(skill: string): { skill: string; items: Resource[] } {
  const cat = categoryOf(skill) as any
  const items = resourcesFor(skill, cat).filter(r => r.type === "practice" || r.type === "project")
  if (!items.some(r => r.type === "project")) items.push(projectIdea(skill))
  return { skill, items }
}

export interface QuizItem { prompt: string; bloom: "recall" | "apply" | "analyse"; skill: string }
/* Honest quiz OUTLINE — question templates across Bloom levels for a skill. These are
 * prompts for a learner/assessor to answer, not fabricated auto-graded Q&A. */
export function quizOutline(skill: string, count = 5): QuizItem[] {
  // Interleaved by Bloom level (recall → apply → analyse → …) so ANY count >= 3 covers
  // all three levels, and counts 1–2 still pick distinct levels.
  const templates: { t: (s: string) => string; bloom: QuizItem["bloom"] }[] = [
    { t: s => `Define the core concept behind ${s} in your own words.`, bloom: "recall" },
    { t: s => `Given a realistic scenario, how would you apply ${s} to solve it?`, bloom: "apply" },
    { t: s => `Compare ${s} with an alternative approach — when would you choose each?`, bloom: "analyse" },
    { t: s => `List the key components or steps involved in ${s}.`, bloom: "recall" },
    { t: s => `Work through a concrete example that uses ${s} end to end.`, bloom: "apply" },
    { t: s => `What are the common mistakes or trade-offs when using ${s}, and why?`, bloom: "analyse" },
  ]
  const out: QuizItem[] = []
  for (let i = 0; i < Math.max(1, Math.min(20, count)); i++) {
    const tpl = templates[i % templates.length]
    out.push({ prompt: tpl.t(skill), bloom: tpl.bloom, skill })
  }
  return out
}

/* A simple concept map: the skill + its category + adjacent focus, for orientation. */
export function conceptMap(skill: string, related: string[] = []): { center: string; category: string; related: string[] } {
  return { center: skill, category: String(categoryOf(skill) || "general"), related: related.filter(r => r && r.toLowerCase() !== skill.toLowerCase()).slice(0, 6) }
}

export interface TutorResponse {
  intent: TutorIntent
  message: string
  studyPlan?: StudySession[]
  practice?: { skill: string; items: Resource[] }
  quiz?: QuizItem[]
  resources?: Resource[]
  conceptMap?: { center: string; category: string; related: string[] }
  explanation: string    // why the tutor responded this way (honesty)
}

/* Compose a tutor response from the classified intent + the learner's focus skills.
 * Retrieval of authoritative "explain" content happens in the AIOS provider; this
 * structures the pedagogy deterministically. */
export function tutorRespond(question: string, opts: { focusSkills?: string[]; days?: number }): TutorResponse {
  const intent = classifyTutorIntent(question)
  const skills = (opts.focusSkills || []).filter(Boolean)
  const primary = skills[0]
  const base = { intent, explanation: `Classified as "${intent}" from your question; structured from your focus skills + the curated resource graph (no fabricated content).` }
  switch (intent) {
    case "plan":
      return { ...base, message: skills.length ? `Here's a ${opts.days || 14}-day plan across ${skills.length} focus area(s).` : "Tell me which skills to plan for.", studyPlan: studyPlan(skills, opts.days || 14) }
    case "practice":
      return primary ? { ...base, message: `Practice for ${primary}:`, practice: practiceSet(primary) } : { ...base, message: "Which skill do you want to practise?" }
    case "quiz":
      return primary ? { ...base, message: `Self-quiz on ${primary} (answer these, then check against a resource):`, quiz: quizOutline(primary) } : { ...base, message: "Which skill should I quiz you on?" }
    case "recommend":
      return primary ? { ...base, message: `Recommended resources for ${primary}:`, resources: resourcesFor(primary, categoryOf(primary) as any) } : { ...base, message: "Which skill do you want resources for?" }
    case "explain":
      return primary ? { ...base, message: `To understand ${primary}, start with these authoritative resources:`, resources: resourcesFor(primary, categoryOf(primary) as any), conceptMap: conceptMap(primary, skills.slice(1)) } : { ...base, message: "What concept would you like explained?" }
    default:
      return { ...base, message: skills.length ? `Focus next on ${primary}. Ask me to plan, practise, quiz, or recommend resources.` : "Ask me to explain a concept, plan your study, generate practice, or recommend resources." }
  }
}
