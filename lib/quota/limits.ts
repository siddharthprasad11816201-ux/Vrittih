/**
 * Plan QUANTITY limits — pure policy, no I/O.
 *
 * Distinct from lib/entitlements, which answers "does this plan include the feature at
 * all?" (binary). This answers "how MUCH of it?" — the numeric caps that were advertised
 * but never enforced server-side.
 */

export type Quota =
  | "active_jobs"
  | "applications_per_month"
  | "candidates"
  | "assessments_per_month"
  | "interview_sessions_per_month"
  | "ai_calls_per_month"
  | "team_members"
  | "mailboxes"
  | "saved_searches"
  | "exports_per_month"
  | "storage_mb"

/** null = unlimited for that plan. */
export type Caps = Partial<Record<Quota, number | null>>

/**
 * Caps by plan id (see lib/plans.ts). Anything absent from a plan's map falls back to
 * FREE_CAPS, so a new plan can never accidentally inherit "unlimited".
 */
export const FREE_CAPS: Required<Caps> = {
  active_jobs: 1,
  applications_per_month: 30,
  candidates: 50,
  assessments_per_month: 10,
  interview_sessions_per_month: 0,
  ai_calls_per_month: 50,
  team_members: 1,
  mailboxes: 0,
  saved_searches: 3,
  exports_per_month: 1,
  storage_mb: 100,
}

export const PLAN_CAPS: Record<string, Caps> = {
  free: {},
  // Individual seeker plans.
  basic: { applications_per_month: 100, ai_calls_per_month: 200, saved_searches: 10, storage_mb: 500 },
  pro: { applications_per_month: null, ai_calls_per_month: 1000, saved_searches: 25, storage_mb: 2000 },
  // Employer tiers.
  emp_starter: {
    active_jobs: 5, candidates: 500, assessments_per_month: 100, interview_sessions_per_month: 20,
    ai_calls_per_month: 1000, team_members: 3, mailboxes: 0, saved_searches: 25, exports_per_month: 10, storage_mb: 5000,
  },
  emp_growth: {
    active_jobs: 25, candidates: 5000, assessments_per_month: 1000, interview_sessions_per_month: 200,
    ai_calls_per_month: 10000, team_members: 15, mailboxes: 3, saved_searches: 100, exports_per_month: 100, storage_mb: 50000,
  },
  emp_scale: {
    active_jobs: null, candidates: null, assessments_per_month: null, interview_sessions_per_month: null,
    ai_calls_per_month: 100000, team_members: 100, mailboxes: 25, saved_searches: null, exports_per_month: null, storage_mb: 500000,
  },
}

/** Quotas counted per calendar month (vs. a standing total like active_jobs). */
export const MONTHLY: ReadonlySet<Quota> = new Set<Quota>([
  "applications_per_month", "assessments_per_month", "interview_sessions_per_month",
  "ai_calls_per_month", "exports_per_month",
])

export function isMonthly(q: Quota): boolean { return MONTHLY.has(q) }

/** Effective cap for a plan. `null` means unlimited. Admins are handled by the caller. */
export function capFor(plan: string | null | undefined, quota: Quota): number | null {
  const p = (plan || "free").toLowerCase()
  const caps = PLAN_CAPS[p]
  if (caps && quota in caps) return caps[quota] as number | null
  return FREE_CAPS[quota]
}

/** Period key a usage row is bucketed under: "YYYY-MM" for monthly, "total" otherwise. */
export function periodKey(quota: Quota, now: Date): string {
  if (!isMonthly(quota)) return "total"
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

export interface QuotaVerdict {
  allowed: boolean
  cap: number | null      // null = unlimited
  used: number
  remaining: number | null
  quota: Quota
}

/** Decide from an already-reserved usage count. PURE. */
export function decideQuota(quota: Quota, cap: number | null, usedAfterReserve: number): QuotaVerdict {
  if (cap === null) return { allowed: true, cap: null, used: usedAfterReserve, remaining: null, quota }
  return {
    allowed: usedAfterReserve <= cap,
    cap,
    used: usedAfterReserve,
    remaining: Math.max(0, cap - usedAfterReserve),
    quota,
  }
}

export function quotaMessage(v: QuotaVerdict): string {
  const label: Record<Quota, string> = {
    active_jobs: "active job posts",
    applications_per_month: "applications this month",
    candidates: "candidates",
    assessments_per_month: "assessments this month",
    interview_sessions_per_month: "interview sessions this month",
    ai_calls_per_month: "AI requests this month",
    team_members: "team members",
    mailboxes: "mailboxes",
    saved_searches: "saved searches",
    exports_per_month: "exports this month",
    storage_mb: "MB of storage",
  }
  return `You have reached your plan limit of ${v.cap} ${label[v.quota]}. Upgrade your plan to continue.`
}
