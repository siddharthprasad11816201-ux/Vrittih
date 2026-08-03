/* Recruitment AI Copilot — deterministic next-best-actions. PURE, testable.
 *
 * EROS Batch 6. The copilot is NOT a chatbot and uses NO external LLM: it reads the
 * recruiter's real operational state (computed by the AIOS provider from the DB) and
 * turns it into a prioritised, explainable list of the highest-leverage actions to take
 * next, each with a concrete deep link. Every suggestion says WHY it surfaced. Runs
 * through the AIOS gateway (audited) like every other capability.
 */

export interface RecruitState {
  offersToSend: number          // APPROVED offers not yet sent
  offersExpiringSoon: number    // SENT offers expiring within 3 days, no response
  scorecardsPending: number     // past interviews missing panel scorecards
  proctorToReview: number       // proctor sessions PENDING at elevated+ risk
  stalePools: number            // talent pools with cooling/cold health
  templatesPending: number      // job templates awaiting the approver
  rolesLowFlow: number          // active roles with very few applications
  referralsToTriage: number     // referrals still SUBMITTED
}

export type Severity = "urgent" | "high" | "medium" | "low"
const SEV_RANK: Record<Severity, number> = { urgent: 4, high: 3, medium: 2, low: 1 }

export interface Suggestion {
  id: string
  title: string
  detail: string
  severity: Severity
  count: number
  action: { label: string; href: string }
}

interface Rule { key: keyof RecruitState; sev: Severity; title: (n: number) => string; detail: (n: number) => string; action: { label: string; href: string } }

const RULES: Rule[] = [
  { key: "offersExpiringSoon", sev: "urgent", title: n => `${n} offer${n > 1 ? "s" : ""} expiring soon`, detail: n => `${n} sent offer${n > 1 ? "s are" : " is"} about to expire with no response — follow up or extend before you lose the candidate.`, action: { label: "Review offers", href: "/offers" } },
  { key: "proctorToReview", sev: "urgent", title: n => `${n} integrity session${n > 1 ? "s" : ""} to review`, detail: n => `${n} proctored session${n > 1 ? "s" : ""} flagged at elevated risk await your decision — a human must clear or flag them.`, action: { label: "Open integrity review", href: "/proctoring" } },
  { key: "offersToSend", sev: "high", title: n => `${n} approved offer${n > 1 ? "s" : ""} ready to send`, detail: n => `${n} offer${n > 1 ? "s have" : " has"} been approved but not sent — send to keep momentum.`, action: { label: "Send offers", href: "/offers" } },
  { key: "scorecardsPending", sev: "high", title: n => `${n} interview${n > 1 ? "s" : ""} awaiting scorecards`, detail: n => `${n} completed interview${n > 1 ? "s are" : " is"} missing panel evaluations — collect them while the signal is fresh.`, action: { label: "Evaluate", href: "/interviews" } },
  { key: "templatesPending", sev: "high", title: n => `${n} role template${n > 1 ? "s" : ""} awaiting approval`, detail: n => `${n} job template${n > 1 ? "s need" : " needs"} your approval before it can be used.`, action: { label: "Review templates", href: "/job-architecture" } },
  { key: "referralsToTriage", sev: "medium", title: n => `${n} referral${n > 1 ? "s" : ""} to triage`, detail: n => `${n} new referral${n > 1 ? "s are" : " is"} waiting — acknowledge and move them into the pipeline.`, action: { label: "Triage referrals", href: "/talent" } },
  { key: "stalePools", sev: "medium", title: n => `${n} talent pool${n > 1 ? "s" : ""} going cold`, detail: n => `${n} pool${n > 1 ? "s have" : " has"} low recent engagement — reach out to warm the pipeline before it goes stale.`, action: { label: "Re-engage pools", href: "/talent" } },
  { key: "rolesLowFlow", sev: "low", title: n => `${n} role${n > 1 ? "s" : ""} with low application flow`, detail: n => `${n} active role${n > 1 ? "s are" : " is"} attracting few candidates — consider sourcing, a referral push, or revisiting the JD.`, action: { label: "Discover talent", href: "/talent" } },
]

export interface CopilotResult { persona: string; summary: string; suggestions: Suggestion[] }

/* Turn recruiter state into a prioritised, explained action list. */
export function recruitCopilot(state: RecruitState, persona = "recruiter"): CopilotResult {
  const suggestions: Suggestion[] = []
  for (const r of RULES) {
    const n = Math.max(0, Math.round((state as any)[r.key] || 0))
    if (n <= 0) continue
    suggestions.push({ id: r.key, title: r.title(n), detail: r.detail(n), severity: r.sev, count: n, action: r.action })
  }
  suggestions.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.count - a.count)
  const urgent = suggestions.filter(s => s.severity === "urgent").length
  const summary = suggestions.length === 0
    ? "You're all caught up — no pressing recruitment actions right now."
    : `${suggestions.length} recommended action${suggestions.length > 1 ? "s" : ""}${urgent ? `, ${urgent} urgent` : ""}. Start at the top.`
  return { persona, summary, suggestions }
}
