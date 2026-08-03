/* Enterprise Competency Framework — the spine of ELTOS. PURE, testable.
 *
 * ELTOS Module 1. Competencies (not courses) are the atomic unit: everything a person
 * learns/does produces evidence that rolls up into a per-person proficiency, which is
 * compared against role/target requirements (gap analysis) and aggregated org-wide
 * (capability heatmap). Deterministic + explainable; competency skills reference the
 * SAME skill graph as recruitment (lib/career/taxonomy) — one Talent Intelligence Graph.
 */

export const COMPETENCY_KINDS = [
  "technical", "behavioural", "leadership", "research", "teaching", "communication", "innovation", "future",
] as const
export type CompetencyKind = (typeof COMPETENCY_KINDS)[number]

export type Band = "Novice" | "Developing" | "Proficient" | "Advanced" | "Expert"
export function proficiencyBand(p: number): Band {
  if (p >= 0.85) return "Expert"
  if (p >= 0.65) return "Advanced"
  if (p >= 0.45) return "Proficient"
  if (p >= 0.2) return "Developing"
  return "Novice"
}

export interface CompetencyDef { key: string; label: string; kind: CompetencyKind; category?: string; skills: string[] }

/* A curated starting library across all kinds (admins can extend/version it). Skills map
 * to lib/career/taxonomy canonical names. */
export const DEFAULT_LIBRARY: CompetencyDef[] = [
  { key: "software-engineering", label: "Software Engineering", kind: "technical", category: "backend", skills: ["Backend", "REST API", "Git", "Testing"] },
  { key: "system-design", label: "System Design", kind: "technical", category: "backend", skills: ["System Design", "Distributed Systems", "Scalability"] },
  { key: "frontend-engineering", label: "Frontend Engineering", kind: "technical", category: "frontend", skills: ["Frontend", "JavaScript", "React", "CSS"] },
  { key: "data-analysis", label: "Data Analysis", kind: "technical", category: "data-ml", skills: ["SQL", "Data Analysis", "Statistics"] },
  { key: "machine-learning", label: "Machine Learning", kind: "technical", category: "data-ml", skills: ["Machine Learning", "Python", "Statistics"] },
  { key: "cloud-devops", label: "Cloud & DevOps", kind: "technical", category: "devops", skills: ["Cloud", "Docker", "Kubernetes", "CI/CD"] },
  { key: "security", label: "Security", kind: "technical", category: "security", skills: ["Security", "Networking"] },
  { key: "problem-solving", label: "Problem Solving", kind: "behavioural", skills: [] },
  { key: "collaboration", label: "Collaboration", kind: "behavioural", skills: [] },
  { key: "ownership", label: "Ownership & Delivery", kind: "behavioural", skills: [] },
  { key: "adaptability", label: "Adaptability", kind: "behavioural", skills: [] },
  { key: "people-leadership", label: "People Leadership", kind: "leadership", skills: ["Leadership", "Mentoring"] },
  { key: "strategy", label: "Strategic Thinking", kind: "leadership", skills: ["Strategy"] },
  { key: "decision-making", label: "Decision Making", kind: "leadership", skills: [] },
  { key: "research-methods", label: "Research Methods", kind: "research", skills: ["Statistics", "Data Analysis"] },
  { key: "scientific-writing", label: "Scientific Writing", kind: "research", skills: [] },
  { key: "instruction", label: "Instruction & Facilitation", kind: "teaching", skills: [] },
  { key: "written-communication", label: "Written Communication", kind: "communication", skills: [] },
  { key: "presentation", label: "Presentation", kind: "communication", skills: [] },
  { key: "product-sense", label: "Product Sense", kind: "innovation", category: "domain", skills: ["Product Management"] },
  { key: "creativity", label: "Creativity", kind: "innovation", skills: [] },
  { key: "ai-literacy", label: "AI Literacy", kind: "future", category: "data-ml", skills: ["Machine Learning"] },
  { key: "data-fluency", label: "Data Fluency", kind: "future", category: "data-ml", skills: ["SQL", "Data Analysis"] },
]

export interface Target { key: string; required: number }        // required proficiency 0..1
export interface GapItem { key: string; have: number; required: number; deficit: number; band: Band }
export interface GapResult {
  gaps: GapItem[]              // where have < required, worst first
  met: string[]               // competency keys already met
  overallReadiness: number    // 0..1 — mean coverage of the targets
  targetCount: number
}

/* Gap of a person's proficiencies against a set of target competency requirements. */
export function gapAnalysis(targets: Target[], have: Record<string, number>): GapResult {
  if (!targets.length) return { gaps: [], met: [], overallReadiness: 0, targetCount: 0 }
  const gaps: GapItem[] = []
  const met: string[] = []
  let coverageSum = 0
  for (const t of targets) {
    const h = Math.max(0, Math.min(1, have[t.key] ?? 0))
    const req = Math.max(0, Math.min(1, t.required))
    coverageSum += req > 0 ? Math.min(1, h / req) : 1
    if (h + 1e-9 >= req) met.push(t.key)
    else gaps.push({ key: t.key, have: +h.toFixed(2), required: +req.toFixed(2), deficit: +(req - h).toFixed(2), band: proficiencyBand(h) })
  }
  gaps.sort((a, b) => b.deficit - a.deficit)
  return { gaps, met, overallReadiness: +(coverageSum / targets.length).toFixed(3), targetCount: targets.length }
}

export interface HeatCell { key: string; avg: number; band: Band; count: number }
/* Org capability heatmap: average proficiency per competency across a population.
 * Weakest first (that's where investment goes). */
export function orgHeatmap(rows: { competencyKey: string; proficiency: number }[]): HeatCell[] {
  const agg = new Map<string, { sum: number; n: number }>()
  for (const r of rows) {
    const g = agg.get(r.competencyKey) || { sum: 0, n: 0 }
    g.sum += Math.max(0, Math.min(1, r.proficiency)); g.n++
    agg.set(r.competencyKey, g)
  }
  const cells: HeatCell[] = []
  // Band from the SAME rounded value that is reported, so avg and band never contradict
  // at a boundary.
  for (const [key, g] of agg) { const avg = +(g.sum / g.n).toFixed(2); cells.push({ key, avg, band: proficiencyBand(avg), count: g.n }) }
  cells.sort((a, b) => a.avg - b.avg)
  return cells
}

/* Map raw evidence signals into a proficiency (0..1). Deterministic weighting by source
 * strength — assessment > project > completed course > endorsement > self. Multiple
 * signals compound with diminishing returns, capped at 1. */
const SOURCE_WEIGHT: Record<string, number> = { assessment: 0.45, project: 0.35, course: 0.3, endorsement: 0.15, self: 0.1 }
export function proficiencyFromEvidence(signals: { source: string; score?: number }[]): number {
  let p = 0
  for (const s of signals) {
    const w = SOURCE_WEIGHT[s.source] ?? 0.1
    const strength = typeof s.score === "number" ? Math.max(0, Math.min(1, s.score)) : 1
    p = p + (1 - p) * w * strength   // diminishing-returns accumulation
  }
  return +Math.max(0, Math.min(1, p)).toFixed(2)
}
