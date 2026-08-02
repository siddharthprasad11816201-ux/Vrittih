/* ICIRE §6 — Career DNA. A professional "fingerprint" derived PURELY from the
 * analyzeCareer output (skills, confidences, categories, evidence) plus measured
 * tenure and role titles. No LLM, no new deps, no fabrication: every dimension
 * cites the real skills/numbers it was computed from, and any dimension that
 * can't be computed honestly is OMITTED rather than guessed. */
import type { CareerAnalysis, SkillResult } from "./engine"

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const r0 = (n: number) => Math.round(n)

// Category -> macro bucket. Languages are foundational/cross-cutting and are not a
// specialization "area", so they sit outside the technical buckets used for lean.
const MACRO: Record<string, string> = {
  frontend: "frontend", design: "frontend",
  backend: "backend", database: "backend",
  "data-ml": "data", cloud: "infra", devops: "infra",
  mobile: "mobile", security: "security", testing: "quality",
}
const BUCKETS = ["frontend", "backend", "data", "infra", "mobile", "security", "quality"]
const BUCKET_LABEL: Record<string, string> = { frontend: "Frontend", backend: "Backend", data: "Data & ML", infra: "Cloud & DevOps", mobile: "Mobile", security: "Security", quality: "Testing & QA" }

export type DnaEvidence = { label: string; detail: string }
export type DnaDimension = { key: string; label: string; kind: "bipolar" | "meter"; value: number; poleLow?: string; poleHigh?: string; band?: string; confidence: number; evidence: DnaEvidence[] }
export type CategoryLean = { bucket: string; label: string; pct: number; top: string[] }
export type CareerArchetype = { key: string; label: string; tagline: string }
export type CareerDNA = {
  computed: boolean
  archetype: CareerArchetype
  narrative: string
  signature: string
  domainFocus: string
  dimensions: DnaDimension[]
  categoryLean: CategoryLean[]
  stats: { skills: number; demonstrated: number; inferred: number; experienceMonths: number; recentSkills: number }
  computedAt: string
}

const LEAD_SKILLS = ["Leadership", "Mentoring", "Project Management", "Management", "Team Leadership", "People Management"]

export function computeCareerDNA(analysis: CareerAnalysis, meta: { experienceMonths?: number; roleTitles?: string[] } = {}): CareerDNA {
  const skills = analysis.skills
  const now = new Date().toISOString()
  if (skills.length === 0) {
    return { computed: false, archetype: { key: "in_progress", label: "Profile in progress", tagline: "Add your experience and skills to reveal your Career DNA." }, narrative: "Add your experience, skills and a résumé, and we'll map your professional fingerprint from real evidence.", signature: "", domainFocus: "", dimensions: [], categoryLean: [], stats: { skills: 0, demonstrated: 0, inferred: 0, experienceMonths: 0, recentSkills: 0 }, computedAt: now }
  }
  const experienceMonths = meta.experienceMonths || 0
  const roleTitles = meta.roleTitles || []
  const demonstrated = skills.filter((s) => !s.implied)

  // Bucket weights (confidence-weighted; implied skills already capped <=0.45).
  const bucket: Record<string, number> = {}
  const bucketSkills: Record<string, SkillResult[]> = {}
  for (const b of BUCKETS) { bucket[b] = 0; bucketSkills[b] = [] }
  for (const s of skills) {
    const b = MACRO[s.category]
    if (!b) continue
    bucket[b] += s.confidence
    bucketSkills[b].push(s)
  }
  const totalTech = BUCKETS.reduce((n, b) => n + bucket[b], 0) || 1
  const topOf = (b: string, n = 2) => bucketSkills[b].sort((a, c) => c.confidence - a.confidence).slice(0, n).map((s) => s.skill)

  const categoryLean: CategoryLean[] = BUCKETS.filter((b) => bucket[b] > 0)
    .map((b) => ({ bucket: b, label: BUCKET_LABEL[b], pct: r0(100 * bucket[b] / totalTech), top: topOf(b) }))
    .sort((a, b) => b.pct - a.pct)
  const domainFocus = categoryLean.length ? categoryLean.slice(0, 2).map((c) => c.label).join(" + ") : "Generalist"

  const dimensions: DnaDimension[] = []

  // 1) Specialist <-> Generalist
  const reach = BUCKETS.filter((b) => bucket[b] >= 0.6).length
  const shares = BUCKETS.map((b) => bucket[b] / totalTech)
  const hhi = shares.reduce((n, x) => n + x * x, 0)
  const reachScore = clamp01((reach - 1) / 4)
  const spreadScore = clamp01((1 - hhi) / (1 - 1 / BUCKETS.length))
  const genValue = r0(100 * (0.6 * reachScore + 0.4 * spreadScore))
  dimensions.push({
    key: "focus", label: "Focus", kind: "bipolar", value: genValue, poleLow: "Specialist", poleHigh: "Generalist",
    confidence: clamp01(totalTech / 3),
    evidence: [
      { label: "Areas", detail: `Active across ${reach} of ${BUCKETS.length} technical areas${categoryLean.length ? " (" + categoryLean.slice(0, 3).map((c) => c.label).join(", ") + ")" : ""}` },
      categoryLean[0] ? { label: "Concentration", detail: `Most weight in ${categoryLean[0].label} (${categoryLean[0].pct}%)` } : { label: "Concentration", detail: "Spread evenly" },
    ],
  })

  // 2) Depth
  const deep = demonstrated.filter((s) => s.confidence >= 0.68)
  const top3 = [...demonstrated].sort((a, b) => b.confidence - a.confidence).slice(0, 3)
  const topConf = top3.length ? top3.reduce((n, s) => n + s.confidence, 0) / top3.length : 0
  const depthRatio = demonstrated.length ? deep.length / demonstrated.length : 0
  const depthValue = r0(100 * clamp01(0.6 * depthRatio + 0.4 * topConf))
  dimensions.push({
    key: "depth", label: "Depth", kind: "meter", value: depthValue, confidence: clamp01(demonstrated.length / 6),
    evidence: [{ label: "Strongest", detail: top3.length ? top3.map((s) => `${s.skill} ${Math.round(s.confidence * 100)}%`).join(", ") : "No demonstrated skills yet" }],
  })

  // 3) Breadth
  const breadthValue = r0(100 * clamp01(0.5 * clamp01(reach / 5) + 0.5 * clamp01(demonstrated.length / 12)))
  dimensions.push({
    key: "breadth", label: "Breadth", kind: "meter", value: breadthValue, confidence: clamp01(demonstrated.length / 8),
    evidence: [{ label: "Range", detail: `${demonstrated.length} demonstrated skills across ${reach} area${reach === 1 ? "" : "s"}` }],
  })

  // 4) Frontend <-> Backend lean — only when there is a real web signal.
  const feBe = bucket.frontend + bucket.backend
  if (feBe >= 0.8) {
    const beValue = r0(100 * bucket.backend / feBe)
    dimensions.push({
      key: "webLean", label: "Web lean", kind: "bipolar", value: beValue, poleLow: "Frontend", poleHigh: "Backend",
      confidence: clamp01(feBe / 3),
      evidence: [
        { label: "Frontend", detail: topOf("frontend").join(", ") || "—" },
        { label: "Backend", detail: topOf("backend").join(", ") || "—" },
      ],
    })
  }

  // 5) IC <-> Leadership
  const leadConfSum = skills.filter((s) => LEAD_SKILLS.includes(s.skill)).reduce((n, s) => n + s.confidence, 0)
  const leadSignal = clamp01(leadConfSum / 1.5)
  const titleLead = roleTitles.some((t) => /lead|manager|head|principal|director|architect|vp|chief|staff/i.test(t)) ? 0.3 : 0
  const leadValue = r0(100 * clamp01(0.7 * leadSignal + titleLead))
  dimensions.push({
    key: "leadership", label: "Working style", kind: "bipolar", value: leadValue, poleLow: "Individual contributor", poleHigh: "Leadership",
    confidence: clamp01((leadConfSum + (titleLead ? 0.6 : 0)) / 1.2),
    evidence: [
      { label: "Signals", detail: leadConfSum > 0 ? skills.filter((s) => LEAD_SKILLS.includes(s.skill)).map((s) => s.skill).join(", ") : "No explicit leadership skills yet" },
      titleLead ? { label: "Titles", detail: roleTitles.filter((t) => /lead|manager|head|principal|director|architect|vp|chief|staff/i.test(t)).join(", ") } : { label: "Titles", detail: "Individual-contributor roles" },
    ],
  })

  // 6) Seniority (meter + band)
  const tenureScore = clamp01(experienceMonths / 96)
  const top5 = [...demonstrated].sort((a, b) => b.confidence - a.confidence).slice(0, 5)
  const masteryScore = top5.length ? top5.reduce((n, s) => n + s.confidence, 0) / top5.length : 0
  const archBonus = demonstrated.some((s) => ["System Design", "Microservices", "Distributed Systems"].includes(s.skill)) ? 0.15 : 0
  const seniorityValue = r0(100 * clamp01(0.45 * tenureScore + 0.4 * masteryScore + archBonus + 0.15 * leadSignal))
  const band = seniorityValue >= 80 ? "Principal / Staff" : seniorityValue >= 62 ? "Senior" : seniorityValue >= 42 ? "Mid" : seniorityValue >= 22 ? "Junior" : "Entry"
  dimensions.push({
    key: "seniority", label: "Seniority", kind: "meter", value: seniorityValue, band,
    confidence: clamp01((experienceMonths / 24 + demonstrated.length / 6) / 2),
    evidence: [
      { label: "Experience", detail: experienceMonths > 0 ? `${(experienceMonths / 12).toFixed(1)} years measured` : "No dated experience yet — band from skill mastery only" },
      { label: "Mastery", detail: top5.length ? `Top skills avg ${Math.round(masteryScore * 100)}%` : "—" },
    ],
  })

  // 7) Learning velocity — HONESTY GATE: recency must come from DATED experience,
  // not from a skill merely being listed now. experienceRecencyYears is derived
  // ONLY from dated experience signals (undated mentions never pin it to 0), so a
  // skill last used years ago is correctly NOT counted as recent. Fewer than 3
  // dated-recency skills -> omit the dimension entirely (never invent).
  const recencyBearing = skills.filter((s) => s.evidence.experienceRecencyYears !== null)
  let recentSkills = 0
  if (recencyBearing.length >= 3) {
    const recent = recencyBearing.filter((s) => (s.evidence.experienceRecencyYears as number) <= 1)
    recentSkills = recent.length
    const velocityValue = r0(100 * clamp01(0.7 * (recent.length / recencyBearing.length) + 0.3 * clamp01(recent.length / 6)))
    dimensions.push({
      key: "velocity", label: "Learning velocity", kind: "meter", value: velocityValue, confidence: clamp01(recencyBearing.length / skills.length),
      evidence: [{ label: "Recent", detail: `${recent.length} of ${recencyBearing.length} experience-backed skills used in the last year` }],
    })
  }

  // Archetype — deterministic, first match wins.
  const topBucket = categoryLean[0]?.bucket
  const topPct = categoryLean[0] ? categoryLean[0].pct / 100 : 0
  const archetype = pickArchetype({ leadValue, seniorityValue, topBucket, topPct, genValue, depthValue, breadthValue, feBe, beLean: feBe >= 0.8 ? r0(100 * bucket.backend / feBe) : null, securityWeight: bucket.security })

  const narrative = buildNarrative(archetype, { reach, domainFocus, top3, band, recentSkills, recencyBearing: recencyBearing.length })
  const signature = buildSignature(categoryLean, genValue, depthValue, breadthValue, band, recencyBearing.length >= 3 ? recentSkills : null, recencyBearing.length)

  return {
    computed: true, archetype, narrative, signature, domainFocus, dimensions, categoryLean,
    stats: { skills: skills.length, demonstrated: demonstrated.length, inferred: skills.length - demonstrated.length, experienceMonths, recentSkills },
    computedAt: now,
  }
}

function pickArchetype(x: { leadValue: number; seniorityValue: number; topBucket?: string; topPct: number; genValue: number; depthValue: number; breadthValue: number; feBe: number; beLean: number | null; securityWeight: number }): CareerArchetype {
  const A = (key: string, label: string, tagline: string) => ({ key, label, tagline })
  if (x.leadValue >= 50 && x.seniorityValue >= 62) return A("eng_leader", "Engineering Leader", "Drives teams and technical direction, not just code.")
  if (x.topBucket === "data" && x.topPct >= 0.4) return A("data_ml", "Data / ML Practitioner", "Turns data into decisions and models.")
  if (x.topBucket === "infra" && x.topPct >= 0.35) return A("platform", "Platform / DevOps Engineer", "Builds the rails everyone else ships on.")
  if (x.topBucket === "mobile" && x.topPct >= 0.35) return A("mobile", "Mobile Developer", "Ships polished apps to real devices.")
  if (x.securityWeight >= 0.35) return A("security", "Security-Focused Engineer", "Builds with the threat model in mind.")
  if (x.beLean !== null && x.beLean >= 35 && x.beLean <= 65 && x.genValue >= 55) return A("fullstack", "Full-Stack Generalist", "Comfortable end to end, front to back.")
  if (x.beLean !== null && x.beLean <= 35) return A("frontend", "Frontend Specialist", "Craft-focused on the user-facing layer.")
  if (x.beLean !== null && x.beLean >= 65) return A("backend", "Backend Specialist", "Owns the services, data and reliability.")
  if (x.depthValue >= 60 && x.breadthValue < 55) return A("specialist", "Domain Specialist", "Deep expertise in a focused area.")
  if (x.depthValue >= 60 && x.breadthValue >= 55) return A("tshaped", "T-Shaped Engineer", "Broad range with real depth where it counts.")
  if (x.breadthValue >= 55 && x.depthValue < 45) return A("early_generalist", "Early-Career Generalist", "Broad and fast-learning — depth is coming.")
  return A(x.topBucket ? x.topBucket + "_dev" : "generalist", (x.topBucket ? (BUCKET_LABEL[x.topBucket] + " Developer") : "Generalist Developer"), "A developing professional profile.")
}

function buildNarrative(a: CareerArchetype, x: { reach: number; domainFocus: string; top3: SkillResult[]; band: string; recentSkills: number; recencyBearing: number }): string {
  const strengths = x.top3.length ? x.top3.map((s) => s.skill).join(", ") : "your listed skills"
  const article = /^[aeiou]/i.test(a.label) ? "an" : "a"
  let out = `You read as ${article} ${a.label} — active across ${x.reach} technical area${x.reach === 1 ? "" : "s"}, strongest in ${x.domainFocus || "your core stack"}. Your deepest skills are ${strengths}.`
  out += ` Overall you sit at a ${x.band.toLowerCase()} level.`
  if (x.recencyBearing >= 3) out += ` ${x.recentSkills} of your experience-backed skills have been used in the last year.`
  return out
}

function buildSignature(lean: CategoryLean[], gen: number, depth: number, breadth: number, band: string, recent: number | null, recencyBearing: number): string {
  const top = lean.slice(0, 2).map((c) => ({ frontend: "FE", backend: "BE", data: "DATA", infra: "INFRA", mobile: "MOB", security: "SEC", quality: "QA" }[c.bucket] || c.bucket.toUpperCase())).join("/")
  const shape = depth >= 60 && breadth >= 55 ? "T-shaped" : gen >= 55 ? "Generalist" : depth >= 60 ? "Specialist" : breadth >= 55 ? "Broad" : "Emerging"
  const bandInitial = { "Principal / Staff": "STAFF", "Senior": "SR", "Mid": "MID", "Junior": "JR", "Entry": "ENTRY" }[band] || band
  const arrow = recent === null ? "" : ` · ${recent >= Math.max(1, recencyBearing / 2) ? "↑ active" : "· steady"}`
  return `${top || "GEN"} · ${shape} · ${bandInitial}${arrow}`
}
