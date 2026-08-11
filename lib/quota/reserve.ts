/**
 * Atomic quota RESERVATION.
 *
 * The naive pattern — count rows, compare to the cap, then create — is a race: two
 * concurrent requests both read `used = cap - 1` and both proceed, overshooting the plan.
 *
 * Instead we RESERVE first (atomic increment on a usage counter), then act, then either
 * commit (keep the reservation) or release (decrement) if the action failed. The counter
 * is the arbiter, so only one of two racing requests can be the one that lands on the cap.
 *
 *   reserve -> [do the work] -> commit          (success)
 *   reserve -> [work failed] -> release         (rolled back)
 *   reserve -> over cap      -> release + deny  (handled inside reserveQuota)
 */
import { prisma } from "@/lib/prisma"
import { capFor, decideQuota, periodKey, quotaMessage, type Quota, type QuotaVerdict } from "./limits"

export * from "./limits"

export interface Reservation {
  verdict: QuotaVerdict
  /** Release the reservation — call when the guarded operation did NOT happen. */
  release: () => Promise<void>
  /** Keep the reservation. A no-op today; explicit so call sites read symmetrically. */
  commit: () => Promise<void>
}

interface Owner { id: string; role?: string | null; plan?: string | null }

/** Admins bypass quantity caps (support + testing), mirroring lib/entitlements. */
const isStaff = (o: Owner) => o.role === "ADMIN" || o.role === "SUPER_ADMIN"

/**
 * Reserve `amount` units. ALWAYS inspect `verdict.allowed`; when false the reservation has
 * already been released for you, so simply return the error.
 */
export async function reserveQuota(owner: Owner, quota: Quota, amount = 1, now: Date = new Date()): Promise<Reservation> {
  const cap = isStaff(owner) ? null : capFor(owner.plan, quota)
  const noop = async () => {}

  if (cap === null) {
    // Unlimited: still record usage (for analytics/billing) but never block.
    await bump(owner.id, quota, periodKey(quota, now), amount).catch(() => {})
    return { verdict: { allowed: true, cap: null, used: 0, remaining: null, quota }, release: noop, commit: noop }
  }

  const period = periodKey(quota, now)
  let used: number
  try {
    used = await bump(owner.id, quota, period, amount)
  } catch {
    // The counter is unavailable. Fail CLOSED for quotas: silently granting unlimited
    // usage is a billing and abuse problem, unlike a rate-limit blip.
    return {
      verdict: { allowed: false, cap, used: cap, remaining: 0, quota },
      release: noop,
      commit: noop,
    }
  }

  const verdict = decideQuota(quota, cap, used)
  if (!verdict.allowed) {
    // Roll the reservation straight back so a denied attempt does not permanently consume
    // budget (otherwise repeated denials would lock the user out even after an upgrade).
    await bump(owner.id, quota, period, -amount).catch(() => {})
    return { verdict, release: noop, commit: noop }
  }

  return {
    verdict,
    release: async () => { await bump(owner.id, quota, period, -amount).catch(() => {}) },
    commit: noop,
  }
}

/** Atomic += delta on the usage counter, returning the NEW value (never below 0). */
async function bump(userId: string, quota: Quota, period: string, delta: number): Promise<number> {
  const where = { userId_quota_period: { userId, quota, period } }
  const updated = await (prisma as any).quotaUsage.updateMany({
    where: { userId, quota, period },
    data: { used: { increment: delta } },
  })
  if (updated.count === 0) {
    try {
      const created = await (prisma as any).quotaUsage.create({
        data: { userId, quota, period, used: Math.max(0, delta) },
        select: { used: true },
      })
      return created.used
    } catch {
      // Lost the create race — the row now exists, so apply the delta to it.
      await (prisma as any).quotaUsage.updateMany({ where: { userId, quota, period }, data: { used: { increment: delta } } })
    }
  }
  const row = await (prisma as any).quotaUsage.findUnique({ where, select: { used: true } })
  const val = row?.used ?? 0
  if (val < 0) {
    // A release can only follow a reserve, but clamp defensively so a counter can never
    // go negative and hand out free budget.
    await (prisma as any).quotaUsage.updateMany({ where: { userId, quota, period }, data: { used: 0 } }).catch(() => {})
    return 0
  }
  return val
}

/** Current usage without reserving — for dashboards. */
export async function quotaStatus(owner: Owner, quota: Quota, now: Date = new Date()): Promise<QuotaVerdict> {
  const cap = isStaff(owner) ? null : capFor(owner.plan, quota)
  const row = await (prisma as any).quotaUsage.findUnique({
    where: { userId_quota_period: { userId: owner.id, quota, period: periodKey(quota, now) } },
    select: { used: true },
  }).catch(() => null)
  const used = row?.used ?? 0
  if (cap === null) return { allowed: true, cap: null, used, remaining: null, quota }
  return { allowed: used < cap, cap, used, remaining: Math.max(0, cap - used), quota }
}

export { quotaMessage }
