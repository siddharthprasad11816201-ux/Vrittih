/* Offer lifecycle — the state machine, PURE and testable.
 *
 * An offer moves through a governed lifecycle with a distinct approval step before it
 * can reach the candidate, versioning via revision, and terminal outcomes. This module
 * owns the legal transitions and who may perform each — the API enforces it, the UI
 * reflects it, and both agree because both import this.
 */

export const OFFER_STATUSES = [
  "DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED",
] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  DRAFT: "Draft", PENDING_APPROVAL: "Pending approval", APPROVED: "Approved",
  SENT: "Sent to candidate", ACCEPTED: "Accepted", DECLINED: "Declined",
  WITHDRAWN: "Withdrawn", EXPIRED: "Expired",
}

export const TERMINAL: OfferStatus[] = ["ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED"]
export function isTerminal(s: string): boolean { return TERMINAL.includes(s as OfferStatus) }

/* Actions and the transitions they cause. `by` says who may perform it:
 *  - "manager": the offer's creator / an approver (pipeline.manage / jobs.post / admin)
 *  - "approver": distinct approver (must differ from creator unless admin)
 *  - "candidate": the person the offer is for */
export type OfferAction = "submit" | "approve" | "send" | "withdraw" | "revise" | "expire" | "accept" | "decline"

interface Transition { from: OfferStatus[]; to: OfferStatus; by: "manager" | "approver" | "candidate" | "system" }

export const TRANSITIONS: Record<OfferAction, Transition> = {
  submit:   { from: ["DRAFT"], to: "PENDING_APPROVAL", by: "manager" },
  approve:  { from: ["PENDING_APPROVAL"], to: "APPROVED", by: "approver" },
  send:     { from: ["APPROVED", "DRAFT"], to: "SENT", by: "manager" },  // DRAFT→SENT allowed when approval is waived (admin)
  withdraw: { from: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"], to: "WITHDRAWN", by: "manager" },
  revise:   { from: ["SENT", "APPROVED", "DECLINED"], to: "DRAFT", by: "manager" }, // creates a new version in DRAFT
  expire:   { from: ["SENT"], to: "EXPIRED", by: "system" },
  accept:   { from: ["SENT"], to: "ACCEPTED", by: "candidate" },
  decline:  { from: ["SENT"], to: "DECLINED", by: "candidate" },
}

export interface TransitionCheck { ok: boolean; to?: OfferStatus; reason?: string }

/* Can this action fire from the current status? (Authorization — who — is enforced by
 * the API against the caller's capabilities; this validates the state legality + role
 * class.) `requireDistinctApprover` blocks self-approval unless the caller is admin. */
export function canTransition(
  action: OfferAction,
  status: string,
  opts?: { isApproverDistinct?: boolean; isAdmin?: boolean; sendRequiresApproval?: boolean },
): TransitionCheck {
  const t = TRANSITIONS[action]
  if (!t) return { ok: false, reason: "Unknown action." }
  if (!t.from.includes(status as OfferStatus)) {
    return { ok: false, reason: `Cannot ${action} an offer that is ${OFFER_STATUS_LABEL[status as OfferStatus] || status}.` }
  }
  if (action === "approve" && !opts?.isAdmin && opts?.isApproverDistinct === false) {
    return { ok: false, reason: "An offer must be approved by someone other than its creator." }
  }
  // Sending straight from DRAFT (skipping approval) is admin-only when approval is required.
  if (action === "send" && status === "DRAFT" && opts?.sendRequiresApproval && !opts?.isAdmin) {
    return { ok: false, reason: "This offer must be approved before it can be sent." }
  }
  return { ok: true, to: t.to }
}

/* Actions available to a manager/approver on an offer in a given status (for the UI). */
export function managerActions(status: string, opts?: { isAdmin?: boolean }): OfferAction[] {
  const out: OfferAction[] = []
  for (const a of ["submit", "approve", "send", "withdraw", "revise"] as OfferAction[]) {
    if (canTransition(a, status, { isAdmin: opts?.isAdmin, isApproverDistinct: true }).ok) out.push(a)
  }
  return out
}

/* Actions a candidate can take (only on a SENT offer). */
export function candidateActions(status: string): OfferAction[] {
  return status === "SENT" ? ["accept", "decline"] : []
}
