/* ICIRE Phase 3 — explainable job matching (§7), explainable AI (§9), hiring
 * probability (§18). In-house, no LLM. Candidate proficiency graph × a job's
 * requirements → compatibility score with a full "why / what's missing / how to
 * close it / projected match / offer odds" breakdown. */
import { extract, type SkillResult } from "./engine"
import { canonical, categoryOf, IMPLY } from "./taxonomy"
import { effectiveConfidence } from "./semantic"
import { skillWeightFactor, calibratedFunnel, type Calibration } from "./calibration"

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const pct = (n: number) => Math.round(clamp01(n) * 100)

export type Requirement = { skill: string; category: string; must: boolean; weight: number }
export type JobLike = { title?: string; description?: string; industry?: string; skills?: string[] }

/** What a job needs: explicit tagged skills (must-have) + skills named/implied in
 * the description (weaker). */
export function jobRequirements(job: JobLike): Requirement[] {
  const req = new Map<string, Requirement>()
  for (const s of job.skills || []) { const c = canonical(s) || s; req.set(c, { skill: c, category: categoryOf(c), must: true, weight: 1 }) }
  const ev = extract([{ kind: "document", text: [job.title, job.description, job.industry].filter(Boolean).join(". ") }])
  for (const [skill, e] of ev as any) {
    if (req.has(skill)) continue
    const named = !e.impliedOnly // spelled out in the JD vs merely implied
    req.set(skill, { skill, category: categoryOf(skill), must: false, weight: named ? 0.8 : 0.45 })
  }
  return [...req.values()]
}

// How hard is it for THIS candidate to acquire a missing skill? Easy if they
// already hold something that leads to it or a strong same-category skill.
function difficulty(skill: string, cand: Map<string, SkillResult>): { label: "Easy" | "Medium" | "Hard"; days: number } {
  const cat = categoryOf(skill)
  const leadsIn = Object.entries(IMPLY).some(([k, v]) => v.map((x) => canonical(x) || x).includes(skill) && cand.has(canonical(k) || k))
  const strongSameCat = [...cand.values()].some((s) => s.category === cat && s.confidence >= 0.6)
  const anySameCat = [...cand.values()].some((s) => s.category === cat && s.confidence >= 0.35)
  if (leadsIn || strongSameCat) return { label: "Easy", days: 14 }
  if (anySameCat) return { label: "Medium", days: 30 }
  return { label: "Hard", days: 60 }
}

export type MatchResult = {
  overall: number          // 0..100
  technical: number
  confidence: number       // how sure we are (evidence coverage)
  matched: { skill: string; category: string; confidence: number; must: boolean }[]
  missing: { skill: string; category: string; must: boolean; difficulty: string; prepDays: number; expectedGain: number; transferFrom?: string }[]
  // Required skills the candidate doesn't hold outright but is partway to via an
  // adjacent skill they DO hold (semantic transfer). Honest: never counted as
  // "matched", only shown as "you're partway here because of X".
  transferable: { skill: string; category: string; via: string; credit: number }[]
  why: string[]
  subscores: { technical: number; communication: number | null; leadership: number | null; research: number | null }
  projectedMatch: number   // after closing the top missing must-haves
  prepDays: number         // total to reach projectedMatch
  hiring: { screening: number; shortlist: number; technical: number; offer: number; label: "High" | "Medium" | "Low"; calibrated?: number; basis?: number }
}

// Weighted coverage of a requirement set under a confidence function. weightFn
// optionally nudges per-skill weight (§21 calibration; identity by default).
function coverage(req: Requirement[], confFn: (s: string) => number, weightFn: (s: string) => number = () => 1) {
  let wSum = 0, cov = 0, techW = 0, techCov = 0, namedW = 0, namedCov = 0, mustW = 0, mustCov = 0
  for (const r of req) {
    const c = confFn(r.skill)
    const w = r.weight * weightFn(r.skill)
    wSum += w; cov += w * c
    if (r.category !== "soft") { techW += w; techCov += w * c }
    if (w >= 0.8) { namedW += w; namedCov += w * clamp01(c / 0.5) } // tagged or spelled out in the JD
    if (r.must) { mustW += w; mustCov += w * clamp01(c / 0.5) }
  }
  const technical = techW ? techCov / techW : wSum ? cov / wSum : 0.5
  const priority = mustW ? mustCov / mustW : namedW ? namedCov / namedW : technical
  return { technical, priority, overall: clamp01(0.65 * technical + 0.35 * priority) }
}

export function matchJob(candidate: SkillResult[], job: JobLike, cal?: Calibration | null): MatchResult {
  const req = jobRequirements(job)
  const cand = new Map(candidate.map((s) => [s.skill, s]))
  const held = new Map(candidate.map((s) => [s.skill, s.confidence]))
  // Exact evidence (used to decide what the candidate genuinely HAS) vs semantic
  // effective confidence (exact, or a capped transfer from an adjacent held skill —
  // used to score effective fit). memoised per skill within this match.
  const exactConf = (sk: string) => cand.get(sk)?.confidence ?? 0
  const effCache = new Map<string, ReturnType<typeof effectiveConfidence>>()
  const eff = (sk: string) => { let e = effCache.get(sk); if (!e) { e = effectiveConfidence(sk, held); effCache.set(sk, e) } return e }
  const conf = (sk: string) => eff(sk).conf

  // §21: recruiter-feedback weight nudge is OFF unless explicitly enabled by an
  // owner, so scores never silently mirror (and entrench) recruiter behaviour.
  const calibrateWeights = cal && process.env.CAREER_CALIBRATE_WEIGHTS === "on"
  const weightFn = calibrateWeights ? (sk: string) => skillWeightFactor(sk, cal) : undefined

  const matched: MatchResult["matched"] = []
  const missingRaw: { skill: string; category: string; must: boolean; transferFrom?: string }[] = []
  const transferable: MatchResult["transferable"] = []
  for (const r of req) {
    // "matched" reflects EXACT evidence only — semantic transfer never fabricates it.
    const ex = exactConf(r.skill)
    if (ex >= 0.4) { matched.push({ skill: r.skill, category: r.category, confidence: ex, must: r.must }); continue }
    const e = eff(r.skill)
    const transferFrom = !e.exact && e.via && e.conf >= 0.25 ? e.via : undefined
    if (transferFrom) transferable.push({ skill: r.skill, category: r.category, via: transferFrom, credit: pct(e.conf) })
    missingRaw.push({ skill: r.skill, category: r.category, must: r.must, transferFrom })
  }
  const actual = coverage(req, conf, weightFn)
  const technical = actual.technical, mustHave = actual.priority, overall = actual.overall

  const missing = missingRaw
    .map((m) => {
      const d = difficulty(m.skill, cand)
      const gain = coverage(req, (sk) => (sk === m.skill ? Math.max(0.7, conf(sk)) : conf(sk)), weightFn).overall - actual.overall
      return { ...m, difficulty: d.label, prepDays: d.days, expectedGain: Math.max(0, Math.round(gain * 100)) }
    })
    .sort((a, b) => Number(b.must) - Number(a.must) || b.expectedGain - a.expectedGain || a.prepDays - b.prepDays)

  // Projected match after closing the top missing skills (must-haves first), ~0.7 mastery.
  const focus = missing.slice(0, 5)
  const gained = new Set(focus.map((m) => m.skill))
  const projected = coverage(req, (sk) => (gained.has(sk) ? Math.max(0.7, conf(sk)) : conf(sk)), weightFn).overall
  const prepDays = focus.reduce((n, m) => n + m.prepDays, 0)

  // Hiring funnel (§18): each stage conditioned on the previous.
  const avgMatched = matched.length ? matched.reduce((n, m) => n + m.confidence, 0) / matched.length : 0
  const screening = clamp01(overall * 1.05)
  const shortlist = screening * (0.55 + 0.45 * mustHave)
  const techRound = shortlist * (0.5 + 0.5 * technical)
  const offer = techRound * (0.55 + 0.45 * avgMatched)
  const label: MatchResult["hiring"]["label"] = offer >= 0.6 ? "High" : offer >= 0.33 ? "Medium" : "Low"
  // §21: informational calibrated advancement rate for this score, when there's
  // enough real outcome data. Display-only — never changes the score above.
  const cf = cal ? calibratedFunnel(pct(overall), cal) : null

  const why = matched.filter((m) => m.must || m.confidence >= 0.6).sort((a, b) => b.confidence - a.confidence).slice(0, 6).map((m) => m.skill)
  const softOrNull = (name: string) => (cand.has(name) ? pct(conf(name)) : null)
  // Confidence in the estimate = how much of the requirement weight we have any signal for.
  const wSum = req.reduce((n, r) => n + r.weight, 0)
  const covered = req.filter((r) => conf(r.skill) > 0).reduce((n, r) => n + r.weight, 0)
  const assessable = wSum ? clamp01(covered / wSum) : 0.5

  return {
    overall: pct(overall), technical: pct(technical), confidence: pct(assessable),
    matched: matched.sort((a, b) => b.confidence - a.confidence),
    missing, transferable: transferable.sort((a, b) => b.credit - a.credit).slice(0, 6), why,
    subscores: { technical: pct(technical), communication: softOrNull("Communication"), leadership: softOrNull("Leadership"), research: softOrNull("Research") },
    projectedMatch: pct(projected), prepDays,
    hiring: { screening: pct(screening), shortlist: pct(shortlist), technical: pct(techRound), offer: pct(offer), label, ...(cf ? { calibrated: Math.round(cf.advanceRate * 100), basis: cf.basis } : {}) },
  }
}

/** Rank a set of jobs for a candidate by fit (+ light, honest tie-breakers). We
 * do NOT fabricate market signals (salary trends, company health) we don't have. */
export function rankJobs(candidate: SkillResult[], jobs: (JobLike & { id: string; createdAt?: any; remote?: boolean })[], cal?: Calibration | null) {
  return jobs
    .map((j) => ({ job: j, match: matchJob(candidate, j, cal) }))
    .sort((a, b) => b.match.overall - a.match.overall || (new Date(b.job.createdAt || 0).getTime() - new Date(a.job.createdAt || 0).getTime()))
}
