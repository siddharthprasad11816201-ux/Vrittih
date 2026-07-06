/**
 * Vrittih in-house job ↔ candidate matching engine.
 *
 * Zero third-party dependencies — pure, deterministic scoring so the algorithm
 * can be owned outright (IP / patent friendly). The same mutual-fit score powers
 * BOTH directions:
 *   - candidate view: "how well does this job fit me"
 *   - employer view:  "how good a candidate is this person for my job"
 */

export interface MatchCandidate {
  headline?: string | null
  bio?: string | null
  location?: string | null
  skills: string[]            // skill names the user has
  experienceTitles: string[]  // job titles from work history
  experienceText: string[]    // free-text from experience descriptions
  educationFields: string[]   // fields of study
  yearsExperience: number
}

export interface MatchJob {
  title: string
  description: string
  industry: string
  location: string
  type: string
  remote: boolean
  skills: string[]            // required/desired skill names
}

export interface MatchResult {
  score: number               // 0–100
  label: "Excellent" | "Strong" | "Good" | "Fair" | "Low"
  breakdown: { skills: number; keywords: number; industry: number; location: number; seniority: number }
  matchedSkills: string[]
  missingSkills: string[]
  reasons: string[]
}

const WEIGHTS = { skills: 40, keywords: 20, industry: 15, location: 15, seniority: 10 }

const STOPWORDS = new Set([
  "the","and","for","with","you","your","our","are","will","who","has","have","this","that","from",
  "job","role","work","team","years","year","experience","looking","join","across","into","per",
  "a","an","of","to","in","on","at","as","or","we","us","is","be","by","it","its","their","they",
  "must","should","strong","good","great","new","all","more","other","plus","etc","using","use",
])

function tokenize(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of (text || "").toLowerCase().split(/[^a-z0-9+#.]+/)) {
    const t = raw.replace(/^\.+|\.+$/g, "")
    if (t.length >= 2 && !STOPWORDS.has(t)) out.add(t)
  }
  return out
}

const norm = (s: string) => s.toLowerCase().trim()

function seniorityRank(title: string): number {
  const t = title.toLowerCase()
  if (/\b(intern|internship|trainee)\b/.test(t)) return 0
  if (/\b(junior|jr|entry|graduate|associate)\b/.test(t)) return 1
  if (/\b(senior|sr|lead|principal|staff)\b/.test(t)) return 3
  if (/\b(head|director|vp|chief|manager|cto|ceo)\b/.test(t)) return 4
  return 2 // mid-level default
}

function yearsToRank(years: number): number {
  if (years < 0.5) return 0
  if (years < 2) return 1
  if (years < 5) return 2
  if (years < 9) return 3
  return 4
}

export function computeMatch(job: MatchJob, cand: MatchCandidate): MatchResult {
  const reasons: string[] = []

  // ---- 1. Skills overlap (strongest signal) ----
  const jobSkills = job.skills.map(norm).filter(Boolean)
  const candSkills = new Set(cand.skills.map(norm).filter(Boolean))
  const candText = tokenize(
    [cand.headline, cand.bio, ...cand.experienceTitles, ...cand.experienceText, ...cand.skills].join(" ")
  )

  let matchedSkills: string[] = []
  let missingSkills: string[] = []
  let skillScore: number

  if (jobSkills.length) {
    for (const s of jobSkills) {
      // credit a match if the user lists the skill OR mentions it anywhere in their profile
      if (candSkills.has(s) || [...tokenize(s)].every((tk) => candText.has(tk))) matchedSkills.push(s)
      else missingSkills.push(s)
    }
    skillScore = matchedSkills.length / jobSkills.length
    if (matchedSkills.length) reasons.push(`Matches ${matchedSkills.length}/${jobSkills.length} required skills`)
  } else {
    // No explicit skills on the job — derive from description keyword coverage
    const jobKw = tokenize(job.title + " " + job.description)
    const overlap = [...jobKw].filter((k) => candText.has(k)).length
    skillScore = jobKw.size ? Math.min(1, overlap / Math.max(6, jobKw.size * 0.35)) : 0.5
  }

  // ---- 2. Keyword / semantic overlap of the whole posting ----
  const jobKw = tokenize(job.title + " " + job.description)
  const overlap = [...jobKw].filter((k) => candText.has(k)).length
  const keywordScore = jobKw.size ? Math.min(1, overlap / Math.max(5, jobKw.size * 0.4)) : 0

  // ---- 3. Industry alignment ----
  const industryTokens = tokenize(job.industry)
  const candIndustryText = tokenize([...cand.experienceTitles, ...cand.educationFields, cand.headline, cand.bio].join(" "))
  const industryHit = [...industryTokens].some((t) => candIndustryText.has(t))
  const industryScore = industryHit ? 1 : 0.35
  if (industryHit) reasons.push(`Background aligns with ${job.industry}`)

  // ---- 4. Location / remote ----
  let locationScore: number
  if (job.remote) { locationScore = 1; reasons.push("Remote — location independent") }
  else if (cand.location && job.location && norm(cand.location) === norm(job.location)) {
    locationScore = 1; reasons.push(`Based in ${job.location}`)
  } else if (cand.location && job.location &&
    (norm(job.location).includes(norm(cand.location)) || norm(cand.location).includes(norm(job.location)))) {
    locationScore = 0.75
  } else locationScore = 0.4

  // ---- 5. Seniority fit ----
  const need = seniorityRank(job.title)
  const have = Math.max(yearsToRank(cand.yearsExperience), ...cand.experienceTitles.map(seniorityRank), 0)
  const gap = Math.abs(need - have)
  const seniorityScore = gap === 0 ? 1 : gap === 1 ? 0.7 : gap === 2 ? 0.45 : 0.2
  if (gap === 0) reasons.push("Seniority level is a strong fit")

  const raw =
    skillScore * WEIGHTS.skills +
    keywordScore * WEIGHTS.keywords +
    industryScore * WEIGHTS.industry +
    locationScore * WEIGHTS.location +
    seniorityScore * WEIGHTS.seniority

  const score = Math.round(Math.max(0, Math.min(100, raw)))
  const label: MatchResult["label"] =
    score >= 85 ? "Excellent" : score >= 70 ? "Strong" : score >= 55 ? "Good" : score >= 40 ? "Fair" : "Low"

  return {
    score,
    label,
    breakdown: {
      skills: Math.round(skillScore * WEIGHTS.skills),
      keywords: Math.round(keywordScore * WEIGHTS.keywords),
      industry: Math.round(industryScore * WEIGHTS.industry),
      location: Math.round(locationScore * WEIGHTS.location),
      seniority: Math.round(seniorityScore * WEIGHTS.seniority),
    },
    matchedSkills,
    missingSkills,
    reasons,
  }
}

/** Build a MatchCandidate from a Prisma user (with skills/experience/education included). */
export function candidateFromUser(u: any): MatchCandidate {
  const experiences = u.experience ?? []
  let years = 0
  for (const e of experiences) {
    const start = e.startDate ? new Date(e.startDate).getTime() : 0
    const end = e.endDate ? new Date(e.endDate).getTime() : Date.now()
    if (start) years += Math.max(0, (end - start) / (1000 * 60 * 60 * 24 * 365))
  }
  return {
    headline: u.headline,
    bio: u.bio,
    location: u.location,
    skills: (u.skills ?? []).map((s: any) => s.skill?.name ?? s.name ?? "").filter(Boolean),
    experienceTitles: experiences.map((e: any) => e.title).filter(Boolean),
    experienceText: experiences.map((e: any) => e.description).filter(Boolean),
    educationFields: (u.education ?? []).map((e: any) => e.field).filter(Boolean),
    yearsExperience: Math.round(years * 10) / 10,
  }
}

/** Build a MatchJob from a Prisma job (with skills included). */
export function jobFromRecord(j: any): MatchJob {
  return {
    title: j.title,
    description: j.description,
    industry: j.industry,
    location: j.location,
    type: j.type,
    remote: !!j.remote,
    skills: (j.skills ?? []).map((s: any) => s.skill?.name ?? s.name ?? "").filter(Boolean),
  }
}
