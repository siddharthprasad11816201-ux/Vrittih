/* 7-day Basic trial helpers — pure. A trial unlocks Basic-tier features and lets
 * the user apply to up to 10 positions. basicActive() is the single check for
 * "has Basic access" = paid OR on a plan OR inside an active trial. */

export type TrialUser = { paid?: boolean | null; plan?: string | null; trialEndsAt?: Date | string | null } | null | undefined

export const TRIAL_DAYS = 7
export const TRIAL_APPLICATION_CAP = 10

export function trialActive(u: TrialUser, now: Date = new Date()): boolean {
  if (!u?.trialEndsAt) return false
  return new Date(u.trialEndsAt).getTime() > now.getTime()
}

/** Basic-tier access: a paid account, any non-free plan, or an active trial. */
export function basicActive(u: TrialUser, now: Date = new Date()): boolean {
  if (!u) return false
  if (u.paid) return true
  if (u.plan && u.plan !== "free") return true
  return trialActive(u, now)
}

export function trialDaysLeft(u: TrialUser, now: Date = new Date()): number {
  if (!u?.trialEndsAt) return 0
  const ms = new Date(u.trialEndsAt).getTime() - now.getTime()
  return ms > 0 ? Math.ceil(ms / 86400000) : 0
}

/** True once a paying user or a used-up trial should no longer be quota-capped. */
export function isTrialCapped(u: TrialUser, now: Date = new Date()): boolean {
  if (!u || u.paid) return false
  if (u.plan && u.plan !== "free") return false
  return trialActive(u, now)   // only active-trial (non-paid) users are capped
}
