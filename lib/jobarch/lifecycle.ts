/* Job Architecture — role/requisition template approval lifecycle. PURE, testable.
 *
 * EROS Module 3. A role template is governed: drafted, submitted, approved by a DISTINCT
 * approver (never self-approval unless admin), versioned via revise, and archivable. The
 * API enforces this; the UI reflects it; both import this so they agree.
 */
export const TEMPLATE_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ARCHIVED"] as const
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number]
export const TEMPLATE_STATUS_LABEL: Record<TemplateStatus, string> = {
  DRAFT: "Draft", PENDING_APPROVAL: "Pending approval", APPROVED: "Approved", ARCHIVED: "Archived",
}

export type TemplateAction = "submit" | "approve" | "archive" | "revise"
interface T { from: TemplateStatus[]; to: TemplateStatus }
export const TEMPLATE_TRANSITIONS: Record<TemplateAction, T> = {
  submit:  { from: ["DRAFT"], to: "PENDING_APPROVAL" },
  approve: { from: ["PENDING_APPROVAL"], to: "APPROVED" },
  archive: { from: ["DRAFT", "PENDING_APPROVAL", "APPROVED"], to: "ARCHIVED" },
  revise:  { from: ["APPROVED", "ARCHIVED"], to: "DRAFT" }, // creates a new version in DRAFT
}

export function canTransition(action: TemplateAction, status: string, opts?: { isApproverDistinct?: boolean; isAdmin?: boolean }): { ok: boolean; to?: TemplateStatus; reason?: string } {
  const t = TEMPLATE_TRANSITIONS[action]
  if (!t) return { ok: false, reason: "Unknown action." }
  if (!t.from.includes(status as TemplateStatus)) return { ok: false, reason: `Cannot ${action} a ${TEMPLATE_STATUS_LABEL[status as TemplateStatus] || status} template.` }
  // Fail-closed: approval needs an admin or an explicitly-distinct approver.
  if (action === "approve" && !opts?.isAdmin && !opts?.isApproverDistinct) {
    return { ok: false, reason: "A template must be approved by someone other than its author." }
  }
  return { ok: true, to: t.to }
}

export function managerActions(status: string, opts?: { isAdmin?: boolean; isApproverDistinct?: boolean }): TemplateAction[] {
  const out: TemplateAction[] = []
  for (const a of ["submit", "approve", "archive", "revise"] as TemplateAction[]) {
    if (canTransition(a, status, { isAdmin: opts?.isAdmin, isApproverDistinct: opts?.isApproverDistinct ?? false }).ok) out.push(a)
  }
  return out
}
