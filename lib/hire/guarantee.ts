/**
 * Guaranteed Hire — the premium, custom-quoted managed-recruitment pack. PURE, no I/O.
 *
 * A NOTE ON THE PROMISE, because it is a commercial and legal commitment, not just copy:
 * an unqualified "100% guaranteed" is not a claim a recruitment service can honour
 * literally — no provider can force a specific person to accept an offer — and an absolute
 * claim with no stated terms is treated as misleading advertising in most jurisdictions,
 * Switzerland included. What IS both honourable and standard is a guarantee with DEFINED
 * TERMS: we fill the role within an agreed window, or you pay nothing and we keep working;
 * if the hire leaves inside the replacement window, we replace them free.
 *
 * That is what this module encodes, so the product can promise something strong AND
 * deliverable. The terms are snapshotted onto each request at acceptance, so a later change
 * to pricing or policy can never retroactively alter a deal already struck.
 */

/** Entry price. Every engagement is custom-quoted from the requirement upward. */
export const BASE_PRICE_CHF = 150

export type HireTier = "STANDARD" | "GUARANTEED"

export interface QuoteInput {
  headcount: number
  seniority?: string | null
  /** How urgently the role must be filled, in days. */
  urgencyDays?: number | null
  /** Niche or heavily-regulated roles cost more to source. */
  specialist?: boolean
}

export interface Quote {
  /** What the engagement costs, in CHF. Never converted from another currency. */
  amountCHF: number
  /** Days to fill, after which the guarantee triggers. */
  guaranteeDays: number
  /** Free-replacement window after the hire starts. */
  replacementDays: number
  breakdown: { label: string; amountCHF: number }[]
}

const SENIORITY_MULTIPLIER: Record<string, number> = {
  junior: 1, mid: 1.4, senior: 2, lead: 2.8, executive: 4,
}

/**
 * Deterministic quote from the requirement. This is an ESTIMATE the operator can override —
 * the stored quote is always the human-agreed figure, never a number the UI invented.
 */
export function quoteFor(input: QuoteInput): Quote {
  const heads = Math.max(1, Math.floor(input.headcount || 1))
  const sen = SENIORITY_MULTIPLIER[String(input.seniority || "mid").toLowerCase()] ?? 1.4

  const base = BASE_PRICE_CHF * sen
  const breakdown = [{ label: `Base engagement (${input.seniority || "Mid"})`, amountCHF: round(base) }]

  let total = base
  if (heads > 1) {
    // Additional seats are cheaper — the sourcing work is largely shared.
    const extra = base * 0.6 * (heads - 1)
    breakdown.push({ label: `${heads - 1} additional hire(s)`, amountCHF: round(extra) })
    total += extra
  }
  if (input.specialist) {
    const spec = base * 0.5
    breakdown.push({ label: "Specialist / regulated role", amountCHF: round(spec) })
    total += spec
  }
  const urgency = input.urgencyDays ?? 30
  if (urgency > 0 && urgency < 14) {
    const rush = base * 0.4
    breakdown.push({ label: "Priority search (under 14 days)", amountCHF: round(rush) })
    total += rush
  }

  return {
    amountCHF: Math.max(BASE_PRICE_CHF, round(total)),
    guaranteeDays: urgency < 14 ? 14 : urgency > 60 ? 60 : Math.max(14, Math.round(urgency)),
    replacementDays: 90,
    breakdown,
  }
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * The terms attached to an engagement. Snapshotted at acceptance so the deal a client
 * agreed to cannot be changed underneath them.
 */
export interface GuaranteeTerms {
  version: string
  baseCHF: number
  amountCHF: number
  guaranteeDays: number
  replacementDays: number
  promise: string
  conditions: string[]
}

export const TERMS_VERSION = "v1"

export function termsFor(quote: Quote): GuaranteeTerms {
  return {
    version: TERMS_VERSION,
    baseCHF: BASE_PRICE_CHF,
    amountCHF: quote.amountCHF,
    guaranteeDays: quote.guaranteeDays,
    replacementDays: quote.replacementDays,
    // Strong, and actually deliverable.
    promise: `We fill this role within ${quote.guaranteeDays} days or you pay nothing — and we keep searching at no cost until it is filled.`,
    conditions: [
      `Free replacement if the hire leaves within ${quote.replacementDays} days of starting.`,
      "The guarantee window starts when the agreed role requirements are confirmed in writing.",
      "It pauses while we are waiting on the client for interview slots or feedback.",
      "It does not apply if the role is withdrawn, materially changed, or the budget is reduced after acceptance.",
      "Fees are quoted and charged in CHF.",
    ],
  }
}

/* ---------------- SLA state ---------------- */

export const HIRE_STATUSES = ["OPEN", "IN_PROGRESS", "SHORTLISTED", "DELIVERED", "CLOSED"] as const
export type HireStatus = (typeof HIRE_STATUSES)[number]

export type GuaranteeState = "NOT_STARTED" | "ON_TRACK" | "AT_RISK" | "BREACHED" | "FULFILLED"

/**
 * Where an engagement stands against its guarantee. PURE — the caller supplies `now`.
 * AT_RISK fires at 75% of the window so an operator has time to act rather than being told
 * only once the promise has already been broken.
 */
export function guaranteeState(opts: {
  acceptedAt?: Date | string | null
  filledAt?: Date | string | null
  guaranteeDays?: number | null
  status?: string | null
  now: Date
}): { state: GuaranteeState; daysRemaining: number | null; deadline: Date | null } {
  const accepted = opts.acceptedAt ? new Date(opts.acceptedAt) : null
  if (opts.filledAt) return { state: "FULFILLED", daysRemaining: null, deadline: null }
  if (!accepted || !opts.guaranteeDays) return { state: "NOT_STARTED", daysRemaining: null, deadline: null }

  const deadline = new Date(accepted.getTime() + opts.guaranteeDays * 86400000)
  const msLeft = deadline.getTime() - opts.now.getTime()
  const daysRemaining = Math.ceil(msLeft / 86400000)

  if (msLeft <= 0) return { state: "BREACHED", daysRemaining, deadline }
  const elapsed = 1 - msLeft / (opts.guaranteeDays * 86400000)
  return { state: elapsed >= 0.75 ? "AT_RISK" : "ON_TRACK", daysRemaining, deadline }
}

/** A breached guarantee means the client owes nothing — state it plainly for the operator. */
export function billableAmount(terms: GuaranteeTerms | null, state: GuaranteeState): number {
  if (!terms) return 0
  return state === "BREACHED" ? 0 : terms.amountCHF
}
