/**
 * Evidence-first interview evaluation. PURE — deterministic scoring with no model call.
 *
 * The rule (§22): never "the AI thinks the candidate is good -> 90/100". A score is only
 * ever the arithmetic consequence of recorded evidence:
 *
 *   question -> answer -> evidence -> competency -> rubric -> score -> confidence
 *
 * Anything without evidence scores nothing and is reported as UNASSESSED, not as zero and
 * not as a guess. Confidence is a function of how much independent evidence exists, so a
 * single remark can never produce a confident verdict.
 */

/** Rubric levels shared with lib/learning/competency's banding. */
export const RUBRIC_LEVELS = [0, 1, 2, 3, 4] as const
export type RubricLevel = (typeof RUBRIC_LEVELS)[number]

export const RUBRIC_LABELS: Record<RubricLevel, string> = {
  0: "No evidence",
  1: "Below expectation",
  2: "Approaching",
  3: "Meets expectation",
  4: "Exceeds expectation",
}

/** Where a piece of evidence came from. Independent sources corroborate; the same source repeated does not. */
export type EvidenceSource = "interview_answer" | "code_sample" | "work_sample" | "assessment" | "reference" | "resume_claim"

/** Trust weight per source. A résumé CLAIM is the weakest possible evidence. */
export const SOURCE_TRUST: Record<EvidenceSource, number> = {
  assessment: 1.0,        // proctored/scored, objective
  code_sample: 0.95,      // executed against tests
  work_sample: 0.85,
  interview_answer: 0.8,  // observed, but subjective
  reference: 0.6,
  resume_claim: 0.25,     // self-reported, unverified
}

export interface EvidenceItem {
  competencyKey: string
  source: EvidenceSource
  /** Rubric level this single observation supports. */
  level: RubricLevel
  /** Verbatim excerpt / pointer justifying the level — required for auditability. */
  excerpt: string
  /** Who or what recorded it. */
  recordedBy?: string
  questionId?: string
}

export interface CompetencyVerdict {
  competencyKey: string
  /** null when there is no evidence — deliberately NOT 0, which would read as "bad". */
  score: number | null
  level: RubricLevel | null
  label: string
  confidence: number          // 0..1
  evidenceCount: number
  distinctSources: number
  assessed: boolean
  excerpts: string[]
}

/** Evidence carrying no excerpt is not evidence — it is an assertion, and is discarded. */
export function isUsable(e: EvidenceItem): boolean {
  return !!e && !!e.competencyKey && typeof e.excerpt === "string" && e.excerpt.trim().length >= 3
}

/**
 * Confidence rises with the AMOUNT and the DIVERSITY of evidence, with diminishing returns,
 * and is hard-capped below 1: an interview is a sample of behaviour, never proof.
 */
export const CONFIDENCE_CAP = 0.9

export function confidenceFor(evidenceCount: number, distinctSources: number, meanTrust: number): number {
  if (evidenceCount <= 0) return 0
  const volume = 1 - Math.pow(0.6, evidenceCount)          // 1 item ≈ .40, 3 ≈ .78, 5 ≈ .92
  const diversity = 1 - Math.pow(0.5, Math.max(1, distinctSources))  // 1 src = .5, 2 = .75
  return +Math.min(CONFIDENCE_CAP, volume * diversity * meanTrust).toFixed(3)
}

/** Roll evidence up into one verdict per competency. Trust-weighted mean of rubric levels. */
export function evaluateCompetency(competencyKey: string, evidence: EvidenceItem[]): CompetencyVerdict {
  const items = evidence.filter((e) => isUsable(e) && e.competencyKey === competencyKey)
  if (!items.length) {
    return {
      competencyKey, score: null, level: null, label: "Not assessed",
      confidence: 0, evidenceCount: 0, distinctSources: 0, assessed: false, excerpts: [],
    }
  }
  let weighted = 0, weight = 0
  const sources = new Set<string>()
  for (const e of items) {
    const t = SOURCE_TRUST[e.source] ?? 0.5
    const lvl = Math.max(0, Math.min(4, Math.round(e.level)))
    weighted += lvl * t
    weight += t
    sources.add(e.source)
  }
  const raw = weight > 0 ? weighted / weight : 0
  const level = Math.max(0, Math.min(4, Math.round(raw))) as RubricLevel
  const meanTrust = weight / items.length
  return {
    competencyKey,
    score: +raw.toFixed(2),
    level,
    label: RUBRIC_LABELS[level],
    confidence: confidenceFor(items.length, sources.size, meanTrust),
    evidenceCount: items.length,
    distinctSources: sources.size,
    assessed: true,
    excerpts: items.map((e) => e.excerpt.trim()).slice(0, 10),
  }
}

export interface InterviewEvaluation {
  competencies: CompetencyVerdict[]
  /** Mean of ASSESSED competencies only, 0..4; null when nothing was assessed. */
  overall: number | null
  overallConfidence: number
  assessedCount: number
  requiredCount: number
  /** Required competencies with no evidence at all — the interview did not cover them. */
  unassessed: string[]
  /** A recommendation is only ever advisory; see decision governance. */
  recommendation: "STRONG_YES" | "YES" | "NO" | "STRONG_NO" | "INSUFFICIENT_EVIDENCE"
}

/**
 * Evaluate a whole interview against the competencies the ROLE requires.
 *
 * If coverage or confidence is too thin the verdict is INSUFFICIENT_EVIDENCE — the system
 * says "we do not know" rather than inventing a decision from a partial signal.
 */
export const MIN_COVERAGE = 0.6
export const MIN_CONFIDENCE = 0.35

export function evaluateInterview(requiredCompetencies: string[], evidence: EvidenceItem[]): InterviewEvaluation {
  const keys = [...new Set(requiredCompetencies.filter(Boolean))]
  const competencies = keys.map((k) => evaluateCompetency(k, evidence))
  const assessed = competencies.filter((c) => c.assessed)
  const unassessed = competencies.filter((c) => !c.assessed).map((c) => c.competencyKey)

  const overall = assessed.length
    ? +(assessed.reduce((s, c) => s + (c.score ?? 0), 0) / assessed.length).toFixed(2)
    : null
  const overallConfidence = assessed.length
    ? +(assessed.reduce((s, c) => s + c.confidence, 0) / assessed.length).toFixed(3)
    : 0
  const coverage = keys.length ? assessed.length / keys.length : 0

  let recommendation: InterviewEvaluation["recommendation"]
  if (!assessed.length || coverage < MIN_COVERAGE || overallConfidence < MIN_CONFIDENCE) {
    recommendation = "INSUFFICIENT_EVIDENCE"
  } else if ((overall ?? 0) >= 3.5) recommendation = "STRONG_YES"
  else if ((overall ?? 0) >= 2.75) recommendation = "YES"
  else if ((overall ?? 0) >= 1.75) recommendation = "NO"
  else recommendation = "STRONG_NO"

  return { competencies, overall, overallConfidence, assessedCount: assessed.length, requiredCount: keys.length, unassessed, recommendation }
}

/* ---------------- Adaptive questioning (§21) ---------------- */

/**
 * Pick the next competency to probe: the one whose verdict is least certain, so questions
 * go where the information gain is highest instead of running a fixed Q1..Q5 list.
 * Deterministic — ties break on key so a replay asks the same thing.
 */
export function nextCompetencyToProbe(evaluation: InterviewEvaluation): string | null {
  const pending = evaluation.competencies
    .slice()
    .sort((a, b) => a.confidence - b.confidence || a.competencyKey.localeCompare(b.competencyKey))
  const target = pending.find((c) => c.confidence < TARGET_CONFIDENCE)
  return target ? target.competencyKey : null
}

/** Stop probing a competency once it is this well evidenced. */
export const TARGET_CONFIDENCE = 0.65

export interface StopDecision { stop: boolean; reason: string }

/**
 * Stop when every required competency is sufficiently evidenced, or a hard budget is hit.
 * A budget stop is reported honestly so the evaluation is not mistaken for full coverage.
 */
export function shouldStop(opts: {
  evaluation: InterviewEvaluation
  questionsAsked: number
  minQuestions: number
  maxQuestions: number
  elapsedMinutes: number
  maxMinutes: number
}): StopDecision {
  if (opts.questionsAsked < opts.minQuestions) return { stop: false, reason: "Minimum question count not yet reached." }
  if (opts.questionsAsked >= opts.maxQuestions) return { stop: true, reason: "Question budget reached — coverage may be incomplete." }
  if (opts.elapsedMinutes >= opts.maxMinutes) return { stop: true, reason: "Time limit reached — coverage may be incomplete." }
  const remaining = nextCompetencyToProbe(opts.evaluation)
  if (!remaining) return { stop: true, reason: "All required competencies are sufficiently evidenced." }
  return { stop: false, reason: `Still gathering evidence for ${remaining}.` }
}
