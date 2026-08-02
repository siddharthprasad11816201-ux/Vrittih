/* ICIRE §16/§17 — interview readiness + mock interview generator. In-house,
 * structured (no LLM): a curated question bank keyed by skill/category, plus
 * behavioral/HR/system-design/company templates, assembled against the job's
 * requirements and the candidate's graph. */
import { jobRequirements, type JobLike } from "./match"
import type { SkillResult } from "./engine"

// Per-skill technical prompts (high-signal). Fallback = templated by skill name.
const BANK: Record<string, string[]> = {
  "JavaScript": ["Explain the event loop and how async/await is scheduled.", "What is a closure? Give a real use you've written.", "Difference between `==` and `===`, and when coercion bites."],
  "TypeScript": ["When would you use a union vs an interface hierarchy?", "Explain generics with a real example from your code.", "What are `unknown` vs `any` and why prefer `unknown`?"],
  "Python": ["Explain generators and when you'd use one over a list.", "How does Python manage memory / garbage collection?", "Walk through decorators with an example you've written."],
  "React": ["When does a component re-render, and how do you prevent needless renders?", "Explain the rules of hooks and why they exist.", "How would you manage server state vs UI state?"],
  "REST API": ["How do you design idempotent endpoints? Which verbs are idempotent?", "How do you version and paginate an API?", "Where do you put auth vs authorization in the request lifecycle?"],
  "SQL": ["Write a query to find the second-highest salary per department.", "What does an index cost on writes, and when would you not add one?", "Explain a JOIN you optimized and how you found the bottleneck."],
  "PostgreSQL": ["Explain EXPLAIN ANALYZE — how do you read it?", "When would you use a partial or composite index?", "How do transactions and isolation levels affect correctness?"],
  "System Design": ["Design a URL shortener for 100M links — data model, scaling, hotspots.", "How would you add caching to a read-heavy service and keep it consistent?", "Design a rate limiter and discuss the tradeoffs."],
  "Docker": ["What's the difference between an image and a container?", "How do you shrink an image and speed up builds (layers/cache)?"],
  "Kubernetes": ["Explain a Deployment vs a StatefulSet.", "How does a Service route to Pods, and what is a readiness probe for?"],
  "Machine Learning": ["How do you detect and fix overfitting?", "Explain precision vs recall and when you'd optimize each.", "Walk through a model you shipped end-to-end."],
  "Data Structures": ["When do you reach for a hash map vs a balanced tree?", "Explain the time/space tradeoff in a problem you solved."],
}
const CATEGORY_TEMPLATES: Record<string, string[]> = {
  frontend: ["Walk through how you'd structure a complex {skill} feature for maintainability.", "How do you test and measure performance in {skill}?"],
  backend: ["How would you design a reliable {skill} service under load?", "How do you handle failures and retries in {skill}?"],
  "data-ml": ["How would you evaluate a {skill} solution honestly?", "What data problems have you hit using {skill}?"],
  devops: ["How would you set up {skill} for a small team, and what breaks first at scale?"],
  database: ["How do you model and index data for {skill} in a write-heavy system?"],
  security: ["What are the top {skill} risks for a web app and how do you mitigate them?"],
}
const BEHAVIORAL = [
  "Tell me about a time you shipped something under a tight deadline. (STAR)",
  "Describe a technical decision you got wrong — what did you learn?",
  "Tell me about a conflict on a team and how you resolved it.",
  "Walk me through the project you're most proud of and your specific role.",
]
const LEADERSHIP = ["Tell me about a time you led or mentored others.", "How do you make a decision when the team disagrees?"]
const HR = [
  "Why are you looking to move, and what are you looking for next?",
  "Where do you see yourself in 2–3 years?",
  "What's your expected compensation and notice period?",
]

function techQuestions(skill: string, category: string): string[] {
  if (BANK[skill]) return BANK[skill]
  const t = CATEGORY_TEMPLATES[category] || ["Explain how you've used {skill} and a tradeoff you weighed."]
  return t.map((q) => q.replace(/\{skill\}/g, skill))
}

export type InterviewPrep = {
  difficulty: "Junior" | "Mid" | "Senior"
  readiness: number            // 0..100
  readinessLabel: "Strong" | "Getting there" | "Needs work"
  focusAreas: { skill: string; have: boolean }[]
  rounds: { name: string; questions: string[] }[]
  tips: string[]
}

export function interviewPrep(candidate: SkillResult[], job: JobLike & { company?: string }, overallMatch: number): InterviewPrep {
  const req = jobRequirements(job)
  const cand = new Map(candidate.map((s) => [s.skill, s]))
  const title = (job.title || "").toLowerCase()
  const difficulty: InterviewPrep["difficulty"] =
    /(principal|staff|lead|senior|sr\.?|head|architect)/.test(title) ? "Senior" : /(intern|junior|jr\.?|trainee|graduate|entry)/.test(title) ? "Junior" : "Mid"

  const tech = req.filter((r) => r.category !== "soft").sort((a, b) => b.weight - a.weight)
  const focusAreas = tech.slice(0, 6).map((r) => ({ skill: r.skill, have: (cand.get(r.skill)?.confidence ?? 0) >= 0.5 }))

  // Technical round: prioritise the role's key skills (mix of strengths + gaps).
  const technical: string[] = []
  for (const r of tech.slice(0, 4)) for (const q of techQuestions(r.skill, r.category)) if (technical.length < 6) technical.push(`[${r.skill}] ${q}`)

  const needsCoding = tech.some((r) => ["Data Structures", "Algorithms"].includes(r.skill)) || difficulty !== "Junior"
  const needsSysDesign = tech.some((r) => ["System Design", "Microservices"].includes(r.skill)) || difficulty === "Senior"

  const rounds: InterviewPrep["rounds"] = [{ name: "Technical", questions: technical }]
  if (needsCoding) rounds.push({ name: "Coding", questions: BANK["Data Structures"].concat(["Given constraints, reason about time/space before coding — then optimize."]) })
  if (needsSysDesign) rounds.push({ name: "System Design", questions: BANK["System Design"] })
  const behavioral = [...BEHAVIORAL]
  if ((cand.get("Leadership")?.confidence ?? 0) >= 0.4 || difficulty === "Senior") behavioral.push(...LEADERSHIP)
  rounds.push({ name: "Behavioral", questions: behavioral.slice(0, 5) })
  rounds.push({ name: "HR", questions: HR.concat(job.company ? [`Why ${job.company}? What do you know about them?`] : ["Why this company specifically?"]) })

  // Readiness: match coverage, tempered by whether the candidate is ready for the
  // round types this role demands.
  let readiness = overallMatch
  if (needsSysDesign && (cand.get("System Design")?.confidence ?? 0) < 0.4) readiness -= 8
  if (needsCoding && (cand.get("Data Structures")?.confidence ?? 0) < 0.4 && (cand.get("Algorithms")?.confidence ?? 0) < 0.4) readiness -= 5
  readiness = Math.max(0, Math.min(100, Math.round(readiness)))
  const readinessLabel: InterviewPrep["readinessLabel"] = readiness >= 70 ? "Strong" : readiness >= 45 ? "Getting there" : "Needs work"

  const tips = [
    `Expect a ${difficulty.toLowerCase()}-level bar. Lead with the ${focusAreas.filter((f) => f.have).slice(0, 2).map((f) => f.skill).join(" & ") || "skills"} you're strong in.`,
    focusAreas.some((f) => !f.have) ? `Shore up ${focusAreas.filter((f) => !f.have).slice(0, 2).map((f) => f.skill).join(" & ")} before the technical round.` : "You cover the core skills — practise explaining them out loud.",
    "Answer behavioural questions with STAR (Situation, Task, Action, Result) and a real metric.",
  ]

  return { difficulty, readiness, readinessLabel, focusAreas, rounds, tips }
}
