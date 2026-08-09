/* ICIRE — evidence-based career direction. In-house, no LLM, no astrology. Given a
 * candidate's REAL signals (skills, experience, education), it scores a set of
 * career-direction archetypes by how well the candidate's demonstrated + adjacent
 * (semantic transfer) skills cover each one, and returns the best-fit directions
 * with the exact skills that justify them. This is what replaces a birth-chart
 * "best-fit career direction" with something computed from real evidence — the
 * astrology reading stays, but only as a clearly-secondary reflection. */
import { analyzeCareer, type AnalyzeInput } from "./engine"
import { effectiveConfidence } from "./semantic"

type Archetype = { label: string; blurb: string; skills: string[] }

// Canonical-skill archetypes (skills must exist in taxonomy.ts so semantic transfer
// and exact evidence both resolve). Ordered by nothing — scored per candidate.
const ARCHETYPES: Archetype[] = [
  { label: "Machine Learning & AI", blurb: "building and shipping models", skills: ["Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "NLP", "Computer Vision", "Data Science", "Python", "scikit-learn"] },
  { label: "Data & Analytics", blurb: "turning data into decisions", skills: ["Data Analysis", "SQL", "Pandas", "NumPy", "Data Science", "Python", "R"] },
  { label: "Backend Engineering", blurb: "designing reliable server systems", skills: ["Backend", "Node.js", "REST API", "PostgreSQL", "System Design", "Microservices", "Authentication", "GraphQL"] },
  { label: "Frontend Engineering", blurb: "crafting user interfaces", skills: ["Frontend", "React", "JavaScript", "TypeScript", "CSS", "HTML", "Next.js", "UI/UX"] },
  { label: "Full-Stack Engineering", blurb: "owning features end to end", skills: ["Frontend", "Backend", "React", "Node.js", "Database Design", "REST API", "TypeScript"] },
  { label: "DevOps & Cloud", blurb: "shipping and running systems at scale", skills: ["Docker", "Kubernetes", "CI/CD", "AWS", "Terraform", "Linux", "Deployment"] },
  { label: "Security Engineering", blurb: "protecting systems and data", skills: ["Security", "Cryptography", "Authentication", "Authorization", "Linux"] },
  { label: "Mobile Engineering", blurb: "building mobile apps", skills: ["React Native", "Flutter", "Android", "iOS", "Kotlin", "Swift"] },
]

export type Direction = { label: string; blurb: string; score: number; matched: string[] }
export type CareerDirection = {
  hasEvidence: boolean
  strength: "STRONG" | "EMERGING" | "EARLY"
  headline: string
  note: string
  basis: string
  directions: Direction[]
  strengths: { skill: string; level: string; demonstrated: boolean }[]
}

const pct = (n: number) => Math.round(n * 100)

export function careerDirection(input: AnalyzeInput): CareerDirection {
  const analysis = analyzeCareer(input)
  const skills = analysis.skills
  const held = new Map(skills.map((s) => [s.skill, s.confidence]))
  const hasEvidence = skills.length > 0
  const expMonths = (input.experiences || []).reduce((n, e) => n + (e.months || 0), 0)

  const scored: Direction[] = ARCHETYPES.map((a) => {
    let sum = 0
    const matched: { skill: string; conf: number }[] = []
    for (const sk of a.skills) {
      const e = effectiveConfidence(sk, held)
      sum += e.conf
      if (e.conf >= 0.3) matched.push({ skill: sk, conf: e.conf })
    }
    return {
      label: a.label, blurb: a.blurb,
      score: a.skills.length ? sum / a.skills.length : 0,
      matched: matched.sort((x, y) => y.conf - x.conf).map((m) => m.skill),
    }
  }).sort((a, b) => b.score - a.score)

  const top = scored[0]
  const strength: CareerDirection["strength"] =
    !hasEvidence || top.score < 0.18 ? "EARLY" : top.score >= 0.42 ? "STRONG" : "EMERGING"

  // Strengths = the candidate's strongest REAL skills (demonstrated first).
  const strengths = skills
    .slice()
    .sort((a, b) => Number(a.implied) - Number(b.implied) || b.confidence - a.confidence)
    .filter((s) => s.category !== "soft" || s.confidence >= 0.5)
    .slice(0, 6)
    .map((s) => ({ skill: s.skill, level: s.level, demonstrated: !s.implied }))

  const basis = hasEvidence
    ? `Computed from your ${skills.length} skill${skills.length === 1 ? "" : "s"}${expMonths ? ` and ${Math.round(expMonths / 12 * 10) / 10} year${expMonths >= 24 ? "s" : ""} of experience` : ""} — not a birth chart.`
    : `Add your skills and experience — or upload your résumé — and this becomes a real, evidence-based direction.`

  let headline: string, note: string
  if (!hasEvidence) {
    headline = "Add your evidence to see your direction"
    note = "Once you add skills or a résumé, we compute your best-fit direction from what you can actually do — never from guesswork."
  } else if (strength === "EARLY") {
    headline = `Your strongest current signal is ${top.label.toLowerCase()}`
    note = `You're early here — ${top.matched.length ? `we can see ${top.matched.slice(0, 3).join(", ")}` : "add a few core skills"} — but a little more evidence will sharpen this.`
  } else {
    headline = `Your evidence points toward ${top.label}`
    note = `Strongest signals: ${top.matched.slice(0, 4).join(", ")}${top.matched.length > 4 ? ", and more" : ""} — ${top.blurb}.`
  }

  return {
    hasEvidence,
    strength,
    headline,
    note,
    basis,
    directions: scored.filter((d) => d.score >= 0.15).slice(0, 3).map((d) => ({ ...d, score: pct(d.score), matched: d.matched.slice(0, 6) })),
    strengths,
  }
}
