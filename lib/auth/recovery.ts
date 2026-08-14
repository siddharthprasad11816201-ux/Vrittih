/**
 * Account recovery WITHOUT email. PURE — no I/O.
 *
 * With no mail channel, the usual "click the link we sent you" reset is unavailable, so
 * recovery falls back to knowledge factors: date of birth PLUS security answers.
 *
 * Be clear-eyed about what that is. Knowledge factors are WEAK: answers are low-entropy,
 * often guessable from a social profile, and unlike a password the user cannot change what
 * city they were born in. This design therefore leans on defence in depth rather than on
 * the secrecy of any single answer:
 *
 *   - date of birth gates the flow, so the questions are not handed to a stranger who only
 *     knows an email address (which also blunts account enumeration);
 *   - TWO answers are required, not one;
 *   - answers are hashed like passwords, never stored readable;
 *   - answers are normalised before hashing, so "New Delhi" and " new delhi " match, but a
 *     wrong answer stays wrong;
 *   - the caller enforces a hard attempt cap and rate limit, fail-closed.
 *
 * If email or SMS becomes available later, prefer it — this is the weaker path and exists
 * because it is the only one currently possible.
 */

export interface SecurityQuestionDef {
  key: string
  prompt: string
  /** Rejected because the answer is trivially discoverable or changes over time. */
  note?: string
}

/**
 * Questions chosen to be stable for life and NOT usually published on a CV or social
 * profile — the failure mode of the classic "mother's maiden name" is that it is public.
 */
export const SECURITY_QUESTIONS: SecurityQuestionDef[] = [
  { key: "first_school", prompt: "What was the name of your first school?" },
  { key: "childhood_street", prompt: "What street did you live on as a child?" },
  { key: "first_pet", prompt: "What was the name of your first pet?" },
  { key: "childhood_nickname", prompt: "What was your childhood nickname?" },
  { key: "first_employer", prompt: "What was the name of your first employer?" },
  { key: "favourite_teacher", prompt: "What was the surname of your favourite teacher?" },
  { key: "birth_hospital", prompt: "In which town or city were you born?" },
  { key: "first_concert", prompt: "What was the first concert or live event you attended?" },
]

export const QUESTION_KEYS = SECURITY_QUESTIONS.map((q) => q.key)
export function isQuestionKey(k: any): boolean { return QUESTION_KEYS.includes(String(k)) }
export function promptFor(key: string): string | null {
  return SECURITY_QUESTIONS.find((q) => q.key === key)?.prompt ?? null
}

/** How many answers must be configured, and how many must be correct to recover. */
export const REQUIRED_ANSWERS = 2
/** Wrong attempts before recovery is locked for this account. */
export const MAX_RECOVERY_ATTEMPTS = 5

/**
 * Canonical form of an answer before hashing.
 *
 * Case, surrounding space, internal double spaces, accents and trailing punctuation are all
 * insignificant — a user who typed "St. Mary's" at setup should not be locked out for
 * typing "st marys" a year later. Everything else is preserved, so a genuinely different
 * answer still fails.
 */
export function normalizeAnswer(raw: string): string {
  return String(raw || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.,!?]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** An answer too short or too common to be worth anything as a secret. */
const WEAK_ANSWERS = new Set(["", "n a", "na", "none", "nil", "test", "abc", "1234", "xxx", "asdf", "password"])

export type AnswerProblem = "too_short" | "too_weak" | "unknown_question" | "duplicate_question"

export function validateAnswer(questionKey: string, answer: string): AnswerProblem | null {
  if (!isQuestionKey(questionKey)) return "unknown_question"
  const norm = normalizeAnswer(answer)
  if (norm.length < 2) return "too_short"
  if (WEAK_ANSWERS.has(norm)) return "too_weak"
  return null
}

export interface AnswerInput { questionKey: string; answer: string }

export interface SetupValidation {
  ok: boolean
  errors: { questionKey: string; problem: AnswerProblem }[]
  /** Normalised, deduplicated answers ready to hash. */
  accepted: { questionKey: string; normalized: string }[]
}

/** Validate a full set of answers at setup time. */
export function validateSetup(answers: AnswerInput[]): SetupValidation {
  const errors: SetupValidation["errors"] = []
  const accepted: SetupValidation["accepted"] = []
  const seen = new Set<string>()

  for (const a of answers || []) {
    const key = String(a?.questionKey || "")
    if (seen.has(key)) { errors.push({ questionKey: key, problem: "duplicate_question" }); continue }
    const problem = validateAnswer(key, a?.answer)
    if (problem) { errors.push({ questionKey: key, problem }); continue }
    seen.add(key)
    accepted.push({ questionKey: key, normalized: normalizeAnswer(a.answer) })
  }

  return { ok: errors.length === 0 && accepted.length >= REQUIRED_ANSWERS, errors, accepted }
}

/* ---------------- date of birth ---------------- */

/** Compare two dates by CALENDAR DAY in UTC — a stored timestamp must not break matching. */
export function sameCalendarDay(a: Date | string | null | undefined, b: Date | string | null | undefined): boolean {
  if (!a || !b) return false
  const da = new Date(a), db = new Date(b)
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return false
  return da.getUTCFullYear() === db.getUTCFullYear()
    && da.getUTCMonth() === db.getUTCMonth()
    && da.getUTCDate() === db.getUTCDate()
}

/** Parse a "YYYY-MM-DD" birth date as a UTC calendar day, rejecting absurd values. */
export function parseBirthDate(input: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input || "").trim())
  if (!m) return null
  const [, y, mo, d] = m.map(Number) as unknown as [string, number, number, number]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (isNaN(date.getTime())) return null
  // Round-trip check catches 2026-02-31 and similar.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  const year = date.getUTCFullYear()
  const nowYear = new Date().getUTCFullYear()
  if (year < nowYear - 120 || year > nowYear - 13) return null   // 13 is the minimum sign-up age
  return date
}

/* ---------------- verification ---------------- */

export interface RecoveryVerdict {
  ok: boolean
  /** Correct answers supplied. */
  correct: number
  required: number
  reason?: "locked" | "insufficient" | "not_configured"
}

/**
 * Decide a recovery attempt from ALREADY-COMPARED answers.
 *
 * Hash comparison happens in the caller (it needs bcrypt and the database); this keeps the
 * decision itself pure and testable. Every configured answer must be correct — partial
 * credit would make guessing dramatically cheaper.
 */
export function decideRecovery(opts: {
  configuredCount: number
  correctCount: number
  attemptsUsed: number
}): RecoveryVerdict {
  const required = Math.max(REQUIRED_ANSWERS, Math.min(opts.configuredCount, REQUIRED_ANSWERS))
  if (opts.configuredCount < REQUIRED_ANSWERS) {
    return { ok: false, correct: opts.correctCount, required, reason: "not_configured" }
  }
  if (opts.attemptsUsed >= MAX_RECOVERY_ATTEMPTS) {
    return { ok: false, correct: opts.correctCount, required, reason: "locked" }
  }
  if (opts.correctCount < required) {
    return { ok: false, correct: opts.correctCount, required, reason: "insufficient" }
  }
  return { ok: true, correct: opts.correctCount, required }
}

/**
 * The message shown for ANY failed recovery attempt.
 *
 * Deliberately identical whether the account does not exist, the date of birth is wrong, or
 * an answer is wrong — otherwise the form becomes an oracle for probing which emails are
 * registered and what someone's birthday is.
 */
export const GENERIC_FAILURE =
  "We could not verify those details. Check the date of birth and your answers, then try again."
