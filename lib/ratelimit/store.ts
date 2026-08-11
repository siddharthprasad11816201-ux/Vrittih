/**
 * DB-backed fixed-window rate limiter — correct across multiple instances.
 *
 * The previous implementation was a process-local Map, which on serverless meant each
 * lambda had its own counter: an attacker simply had to land on different instances to
 * multiply their budget. The counter now lives in the database, so every instance
 * increments the SAME row.
 *
 * Atomicity: we UPDATE ... count = count + 1 first (a single atomic statement). Only when
 * no row exists do we CREATE, and a lost create race surfaces as a unique-constraint
 * violation which we absorb by retrying the update. Two concurrent requests can therefore
 * never both read a stale count and both be allowed past the limit.
 */
import { prisma } from "@/lib/prisma"
import {
  budgetFor, decide, rateKey, windowStart,
  type Decision, type RateCategory,
} from "./policy"

export * from "./policy"

export interface LimitOptions {
  /** Override the category budget (rarely needed). */
  limit?: number
  windowSeconds?: number
  /** Extra namespace, e.g. a route name or tenant id. */
  scope?: string
  /** Fail OPEN when the store itself errors (default) or fail CLOSED. */
  failOpen?: boolean
}

/**
 * Consume one unit of budget. Returns the decision; the caller enforces it.
 *
 * On a store failure this fails OPEN by default — a database blip must not lock every
 * user out of the product. Security-critical callers (auth) can pass failOpen:false.
 */
export async function rateLimit(
  category: RateCategory,
  identifier: string,
  opts: LimitOptions = {},
): Promise<Decision> {
  const base = budgetFor(category)
  const budget = {
    limit: opts.limit ?? base.limit,
    windowSeconds: opts.windowSeconds ?? base.windowSeconds,
  }
  const now = new Date()
  const start = windowStart(now, budget.windowSeconds)
  const key = rateKey(category, identifier, opts.scope)
  const expiresAt = new Date(start.getTime() + budget.windowSeconds * 1000)

  try {
    const count = await increment(key, start, expiresAt)
    return decide(count, budget, start, now)
  } catch {
    // Store unavailable.
    if (opts.failOpen === false) {
      return { allowed: false, limit: budget.limit, remaining: 0, resetAt: expiresAt, retryAfterSeconds: 30 }
    }
    return { allowed: true, limit: budget.limit, remaining: budget.limit, resetAt: expiresAt, retryAfterSeconds: 0 }
  }
}

/** Atomic +1 returning the NEW count. */
async function increment(key: string, start: Date, expiresAt: Date): Promise<number> {
  // Fast path: the row already exists for this window — one atomic statement.
  const updated = await (prisma as any).rateHit.updateMany({
    where: { key, windowStart: start },
    data: { count: { increment: 1 } },
  })
  if (updated.count > 0) {
    const row = await (prisma as any).rateHit.findUnique({
      where: { key_windowStart: { key, windowStart: start } },
      select: { count: true },
    })
    return row?.count ?? 1
  }

  // First request in this window.
  try {
    const created = await (prisma as any).rateHit.create({
      data: { key, windowStart: start, count: 1, expiresAt },
      select: { count: true },
    })
    return created.count
  } catch {
    // Lost the create race — the winner's row exists, so increment it instead.
    await (prisma as any).rateHit.updateMany({
      where: { key, windowStart: start },
      data: { count: { increment: 1 } },
    })
    const row = await (prisma as any).rateHit.findUnique({
      where: { key_windowStart: { key, windowStart: start } },
      select: { count: true },
    })
    return row?.count ?? 1
  }
}

/** Clear a counter (e.g. after a successful login, so a user isn't punished for typos). */
export async function clearRateLimit(category: RateCategory, identifier: string, scope?: string): Promise<void> {
  try {
    await (prisma as any).rateHit.deleteMany({ where: { key: rateKey(category, identifier, scope) } })
  } catch { /* clearing is best-effort */ }
}

/** Delete expired windows. Called by the maintenance cron — the table must not grow forever. */
export async function sweepRateLimits(now: Date = new Date()): Promise<number> {
  const r = await (prisma as any).rateHit.deleteMany({ where: { expiresAt: { lt: now } } })
  return r.count ?? 0
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: { headers: { get(n: string): string | null } }): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}
