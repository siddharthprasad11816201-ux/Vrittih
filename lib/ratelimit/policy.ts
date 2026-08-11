/**
 * Rate-limit POLICY — pure, deterministic, no I/O and no clock reads.
 *
 * Separated from the store so the limits, key derivation and window math can be tested
 * exhaustively without a database. Different endpoint classes get different budgets: a
 * single global limit is wrong (login brute-force and job search have nothing in common).
 */

export type RateCategory =
  | "auth"                // login / password attempts — brute-force surface
  | "auth_reset"          // password reset / OTP send
  | "register"
  | "application_submit"
  | "assessment_start"
  | "assessment_answer"
  | "assessment_submit"
  | "interview_response"
  | "transcription"
  | "ai_generation"
  | "file_upload"
  | "search"
  | "alerts"
  | "notifications"
  | "report"
  | "write"               // generic authenticated mutation
  | "read"                // generic authenticated read

export interface Budget {
  /** Maximum requests permitted inside the window. */
  limit: number
  /** Fixed-window length in seconds. */
  windowSeconds: number
}

/**
 * Budgets are deliberately explicit per category. Tight where abuse is costly or
 * dangerous (auth, AI, transcription); generous where the action is cheap and legitimate
 * users burst (search, read).
 */
export const BUDGETS: Record<RateCategory, Budget> = {
  auth:                { limit: 5,    windowSeconds: 15 * 60 },
  auth_reset:          { limit: 5,    windowSeconds: 60 * 60 },
  register:            { limit: 5,    windowSeconds: 15 * 60 },
  application_submit:  { limit: 30,   windowSeconds: 60 * 60 },
  assessment_start:    { limit: 20,   windowSeconds: 60 * 60 },
  assessment_answer:   { limit: 600,  windowSeconds: 60 * 60 },
  assessment_submit:   { limit: 20,   windowSeconds: 60 * 60 },
  interview_response:  { limit: 600,  windowSeconds: 60 * 60 },
  transcription:       { limit: 120,  windowSeconds: 60 * 60 },
  ai_generation:       { limit: 60,   windowSeconds: 60 * 60 },
  file_upload:         { limit: 40,   windowSeconds: 60 * 60 },
  search:              { limit: 300,  windowSeconds: 5 * 60 },
  alerts:              { limit: 60,   windowSeconds: 60 * 60 },
  notifications:       { limit: 300,  windowSeconds: 60 * 60 },
  report:              { limit: 20,   windowSeconds: 60 * 60 },
  write:               { limit: 240,  windowSeconds: 5 * 60 },
  read:                { limit: 600,  windowSeconds: 5 * 60 },
}

export function budgetFor(category: RateCategory): Budget {
  return BUDGETS[category] ?? BUDGETS.write
}

/**
 * Start of the fixed window containing `now`, aligned to the epoch. Alignment means every
 * instance computes the SAME window boundary from the same clock — which is what makes the
 * DB-backed counter correct across serverless invocations.
 */
export function windowStart(now: Date, windowSeconds: number): Date {
  const w = Math.max(1, Math.floor(windowSeconds))
  const ms = w * 1000
  return new Date(Math.floor(now.getTime() / ms) * ms)
}

export function windowEnd(start: Date, windowSeconds: number): Date {
  return new Date(start.getTime() + Math.max(1, Math.floor(windowSeconds)) * 1000)
}

/**
 * Compose the counter key. Identity is caller-supplied (user id, ip, api key, tenant) and
 * is namespaced by category so budgets never bleed into one another.
 */
export function rateKey(category: RateCategory, identifier: string, scope?: string): string {
  const id = String(identifier || "anon").slice(0, 200)
  return scope ? `${category}:${scope}:${id}` : `${category}:${id}`
}

export interface Decision {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: Date
  retryAfterSeconds: number
}

/** Decide from an already-incremented count. Pure. */
export function decide(count: number, budget: Budget, start: Date, now: Date): Decision {
  const resetAt = windowEnd(start, budget.windowSeconds)
  const allowed = count <= budget.limit
  return {
    allowed,
    limit: budget.limit,
    remaining: Math.max(0, budget.limit - count),
    resetAt,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
  }
}

/** Standard headers so clients can back off correctly. */
export function rateHeaders(d: Decision): Record<string, string> {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(d.limit),
    "X-RateLimit-Remaining": String(d.remaining),
    "X-RateLimit-Reset": String(Math.floor(d.resetAt.getTime() / 1000)),
  }
  if (!d.allowed) h["Retry-After"] = String(d.retryAfterSeconds)
  return h
}
