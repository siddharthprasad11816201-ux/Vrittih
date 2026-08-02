/* ICIRE §21 — recruiter-feedback calibration (pure, no LLM, no DB). Learns from
 * REAL application outcomes to (a) show an empirically-calibrated hiring funnel and
 * (b) surface k-anonymized, PII-free skill signals to candidates.
 *
 * FAIRNESS GUARDS (mandated):
 *  - The score-altering weight nudge is applied by match.ts ONLY when the env flag
 *    CAREER_CALIBRATE_WEIGHTS === "on" (default off) — calibration mirrors recruiter
 *    behaviour and must not silently entrench it.
 *  - feedbackSignals() enforces k-anonymity FIRST and never emits raw counts, a
 *    single job/employer, or any identity field. Calibration keys on SKILL signals
 *    only — never demographics.
 *  - With little/no data every function is a no-op (weight 1.0, funnel/​feedback
 *    null) so matchJob output is byte-identical to today's. */

export const STAGE: Record<string, number> = {
  APPLIED: 1, REVIEWED: 1, SCREENING: 1,
  SHORTLISTED: 2,
  ASSESSMENT: 3, INTERVIEW: 3, INTERVIEWING: 3,
  OFFERED: 4, OFFER: 4, ACCEPTED: 4,
  HIRED: 5,
}
export const TERMINAL_NEG = new Set(["REJECTED", "WITHDRAWN", "DECLINED"])
const ADVANCE_STAGE = 2 // shortlist+ counts as "advanced"

export function reachedStage(status: string): number { return STAGE[(status || "").toUpperCase()] ?? 0 }
export function isDecided(status: string): boolean {
  const s = (status || "").toUpperCase()
  return TERMINAL_NEG.has(s) || reachedStage(s) >= ADVANCE_STAGE
}

export type CalRecord = { overall: number; advanced: boolean; skills: { skill: string; covered: boolean }[]; jobId: string; employerId: string }
export type StageBucket = { lo: number; hi: number; n: number; rate: number }
export type SkillStat = { withN: number; withAdv: number; withoutN: number; withoutAdv: number }
export type Calibration = { buckets: StageBucket[]; skills: Record<string, SkillStat>; baseAdvRate: number; sampleSize: number; jobCount: number; employerCount: number }

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Pool Adjacent Violators — smallest monotonic-nondecreasing fit to (rate,weight). */
function pav(rates: number[], weights: number[]): number[] {
  const n = rates.length
  const val = rates.slice(), w = weights.slice(), idx = rates.map((_, i) => i)
  const stackV: number[] = [], stackW: number[] = [], stackS: number[] = []
  for (let i = 0; i < n; i++) {
    let v = val[i], ww = w[i], s = 1
    while (stackV.length && stackV[stackV.length - 1] > v) {
      const pv = stackV.pop()!, pw = stackW.pop()!, ps = stackS.pop()!
      v = (v * ww + pv * pw) / (ww + pw); ww += pw; s += ps
    }
    stackV.push(v); stackW.push(ww); stackS.push(s)
  }
  const out: number[] = []
  for (let k = 0; k < stackV.length; k++) for (let j = 0; j < stackS[k]; j++) out.push(stackV[k])
  return out
}

/** Build calibration from DECIDED application records. Beta-Binomial shrinkage
 * toward the base rate keeps small buckets honest; PAV enforces monotonicity. */
export function buildCalibration(records: CalRecord[]): Calibration {
  const decided = records
  const jobs = new Set(decided.map((r) => r.jobId))
  const employers = new Set(decided.map((r) => r.employerId))
  const advCount = decided.filter((r) => r.advanced).length
  const baseAdvRate = decided.length ? advCount / decided.length : 0

  // 10 score deciles.
  const raw: { n: number; adv: number }[] = Array.from({ length: 10 }, () => ({ n: 0, adv: 0 }))
  for (const r of decided) {
    const b = Math.min(9, Math.max(0, Math.floor(r.overall / 10)))
    raw[b].n++; if (r.advanced) raw[b].adv++
  }
  const PRIOR = 8 // shrinkage strength
  const shrunk = raw.map((x) => (x.adv + PRIOR * baseAdvRate) / (x.n + PRIOR))
  const weights = raw.map((x) => x.n + PRIOR)
  const iso = pav(shrunk, weights)
  const buckets: StageBucket[] = raw.map((x, i) => ({ lo: i * 10, hi: i * 10 + 9, n: x.n, rate: Math.round(clamp01(iso[i]) * 1000) / 1000 }))

  // Per-skill advancement, covered vs not.
  const skills: Record<string, SkillStat> = {}
  for (const r of decided) {
    for (const s of r.skills) {
      const st = (skills[s.skill] ||= { withN: 0, withAdv: 0, withoutN: 0, withoutAdv: 0 })
      if (s.covered) { st.withN++; if (r.advanced) st.withAdv++ } else { st.withoutN++; if (r.advanced) st.withoutAdv++ }
    }
  }
  return { buckets, skills, baseAdvRate, sampleSize: decided.length, jobCount: jobs.size, employerCount: employers.size }
}

/** Empirically-calibrated advancement (shortlist) probability for a score, or null
 * when there isn't enough data to be trustworthy. Informational only. */
export function calibratedFunnel(overall: number, cal: Calibration): { advanceRate: number; basis: number } | null {
  if (!cal || cal.sampleSize < 40 || cal.jobCount < 5) return null
  const b = cal.buckets[Math.min(9, Math.max(0, Math.floor(overall / 10)))]
  if (!b) return null
  return { advanceRate: b.rate, basis: cal.sampleSize }
}

/** Bounded weight nudge for a skill (0.8–1.3). match.ts applies this ONLY behind
 * the env flag. Requires >=12 per arm; otherwise neutral 1.0 (never overfit). */
export function skillWeightFactor(skill: string, cal?: Calibration): number {
  if (!cal) return 1
  const st = cal.skills[skill]
  if (!st || st.withN < 12 || st.withoutN < 12) return 1
  const withRate = st.withAdv / st.withN
  const withoutRate = st.withoutAdv / st.withoutN
  if (withoutRate <= 0) return withRate > cal.baseAdvRate ? 1.15 : 1
  const lift = withRate / withoutRate
  return Math.max(0.8, Math.min(1.3, lift))
}

export type FeedbackSignal = { skill: string; direction: "up" | "down"; liftPct: number }

/** k-anonymized candidate feedback. The privacy gate is the FIRST statement; it
 * never emits raw counts, a single job/employer, or a recruiter decision. */
export function feedbackSignals(cal: Calibration): FeedbackSignal[] | null {
  if (!cal || cal.sampleSize < 30 || cal.jobCount < 5 || cal.employerCount < 2) return null
  const out: FeedbackSignal[] = []
  for (const [skill, st] of Object.entries(cal.skills)) {
    if (st.withN < 12 || st.withoutN < 12) continue
    const withRate = st.withAdv / st.withN
    const withoutRate = st.withoutAdv / st.withoutN
    if (withoutRate <= 0 && withRate <= 0) continue
    const lift = withoutRate > 0 ? (withRate - withoutRate) / withoutRate : 1
    if (Math.abs(lift) < 0.15) continue
    out.push({ skill, direction: lift > 0 ? "up" : "down", liftPct: Math.round(Math.abs(lift) * 100) })
  }
  return out.sort((a, b) => b.liftPct - a.liftPct).slice(0, 8)
}
