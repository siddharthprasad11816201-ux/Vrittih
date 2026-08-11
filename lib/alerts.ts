/**
 * Saved searches + job alerts (the Indeed retention loop). PURE, deterministic helpers so
 * the alert decision is fully testable without a database or a clock.
 *
 * The stored query is exactly the filter set the /jobs UI already builds, so a saved search
 * re-runs the identical search the user performed.
 */

export interface SearchQuery {
  q?: string
  industry?: string
  type?: string
  remote?: boolean
  minMatch?: number   // 0..100 — only alert on jobs scoring at least this
}

export const ALERT_FREQS = ["off", "daily", "weekly"] as const
export type AlertFreq = (typeof ALERT_FREQS)[number]

/** Coerce arbitrary client input into a safe, bounded query object. */
export function normalizeQuery(raw: any): SearchQuery {
  const out: SearchQuery = {}
  if (raw && typeof raw === "object") {
    const str = (v: any, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined)
    out.q = str(raw.q, 120)
    out.industry = str(raw.industry, 80)
    out.type = str(raw.type, 40)
    if (typeof raw.remote === "boolean") out.remote = raw.remote
    if (typeof raw.minMatch === "number" && isFinite(raw.minMatch)) {
      out.minMatch = Math.max(0, Math.min(100, Math.round(raw.minMatch)))
    }
  }
  return out
}

export function normalizeFreq(v: any): AlertFreq {
  return (ALERT_FREQS as readonly string[]).includes(v) ? (v as AlertFreq) : "daily"
}

/** Human-readable label for a saved search, used when the user doesn't name it. */
export function describeQuery(query: SearchQuery): string {
  const bits: string[] = []
  if (query.q) bits.push(`"${query.q}"`)
  if (query.industry) bits.push(query.industry)
  if (query.type) bits.push(query.type)
  if (query.remote) bits.push("Remote")
  if (typeof query.minMatch === "number" && query.minMatch > 0) bits.push(`${query.minMatch}%+ match`)
  return bits.length ? bits.join(" · ") : "All jobs"
}

/** Is this alert due to run? Weekly alerts wait 7 days; "off" never runs. */
export function isDue(freq: AlertFreq, lastRunAt: Date | null | undefined, now: Date): boolean {
  if (freq === "off") return false
  if (!lastRunAt) return true
  const hours = (now.getTime() - new Date(lastRunAt).getTime()) / 3600000
  // Slightly under the nominal period so a daily cron at a fixed hour never skips a day.
  return freq === "weekly" ? hours >= 167 : hours >= 23
}

export interface AlertJob { id: string; createdAt: Date; score?: number }

/**
 * Which jobs should this alert notify about?
 * A job qualifies when it was created AFTER the diff cursor (lastNotified) and meets the
 * minimum match score. Returns the qualifying jobs (newest first) and the new cursor.
 */
export function newMatches(
  jobs: AlertJob[],
  lastNotified: Date | null | undefined,
  minMatch = 0,
): { matches: AlertJob[]; cursor: Date | null } {
  const cut = lastNotified ? new Date(lastNotified).getTime() : 0
  const min = Math.max(0, Math.min(100, minMatch || 0))
  const matches = jobs
    .filter((j) => new Date(j.createdAt).getTime() > cut)
    .filter((j) => (typeof j.score === "number" ? j.score >= min : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  // Advance the cursor past every job we CONSIDERED (not just those that matched), so a
  // low-scoring job is never re-examined and can't resurface in a later run.
  let cursor: Date | null = lastNotified ? new Date(lastNotified) : null
  for (const j of jobs) {
    const t = new Date(j.createdAt)
    if (!cursor || t.getTime() > cursor.getTime()) cursor = t
  }
  return { matches, cursor }
}

/** Notification copy for an alert firing. Never invents numbers — counts are real. */
export function alertNotification(name: string, matches: AlertJob[]): { title: string; body: string } {
  const n = matches.length
  return {
    title: `${n} new job${n === 1 ? "" : "s"} for "${name}"`,
    body: n === 1 ? "A new job matches your saved search." : `${n} new jobs match your saved search.`,
  }
}
