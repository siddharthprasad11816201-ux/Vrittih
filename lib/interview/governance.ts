/* Interview attendance governance — pure, testable.
 *
 * Two concerns:
 *  1) PANEL COMPOSITION — a senior/executive candidate should not be interviewed
 *     by an under-ranked panel. We compare the position's role level against the
 *     seniority of the interviewers on the panel and block (or warn) when the
 *     panel is too junior.
 *  2) WHO MAY ATTEND / VIEW — a visibility rule (only invited participants, the
 *     hosting company, or anyone with the link) plus a confidential flag that
 *     keeps notes/recording away from OBSERVER-role attendees.
 *
 * No external services, no ML — deterministic rules a hiring team can reason about.
 */

// Seniority bands for people (interviewers). Ordered low → high.
export const SENIORITY = ["JUNIOR", "MID", "SENIOR", "LEAD", "EXECUTIVE"] as const
export type Seniority = (typeof SENIORITY)[number]

// Seniority band of the *position* being interviewed for.
export const ROLE_LEVELS = ["IC", "SENIOR", "LEAD", "EXECUTIVE"] as const
export type RoleLevel = (typeof ROLE_LEVELS)[number]

// Roles a participant can hold inside an interview.
export const ATTENDEE_ROLES = ["HOST", "PANELIST", "INTERVIEWER", "COORDINATOR", "OBSERVER", "CANDIDATE"] as const
export type AttendeeRole = (typeof ATTENDEE_ROLES)[number]

// Roles that actually assess the candidate (count toward panel seniority).
export const ASSESSING_ROLES: AttendeeRole[] = ["HOST", "PANELIST", "INTERVIEWER"]

export const VISIBILITY = ["PARTICIPANTS", "COMPANY", "LINK"] as const
export type Visibility = (typeof VISIBILITY)[number]

export const SENIORITY_LABEL: Record<Seniority, string> = {
  JUNIOR: "Junior", MID: "Mid-level", SENIOR: "Senior", LEAD: "Lead / Manager", EXECUTIVE: "Executive",
}
export const ROLE_LEVEL_LABEL: Record<RoleLevel, string> = {
  IC: "Individual contributor", SENIOR: "Senior", LEAD: "Lead / Manager", EXECUTIVE: "Executive",
}
export const VISIBILITY_LABEL: Record<Visibility, string> = {
  PARTICIPANTS: "Invited participants only",
  COMPANY: "Anyone at the hosting company",
  LINK: "Anyone with the room link",
}

export function seniorityRank(s: string | null | undefined): number {
  const i = SENIORITY.indexOf((s || "MID").toUpperCase() as Seniority)
  return i < 0 ? 1 : i // default MID
}

/* The minimum interviewer seniority a given role level requires on its panel.
 * An executive search must have an executive (or at least a lead) in the room;
 * a senior IC needs at least a senior interviewer; an IC role can be run by mid. */
export function requiredSeniorityFor(roleLevel: string | null | undefined): Seniority {
  switch ((roleLevel || "IC").toUpperCase()) {
    case "EXECUTIVE": return "LEAD"      // exec candidate ⇒ at least a lead-level interviewer
    case "LEAD": return "SENIOR"
    case "SENIOR": return "SENIOR"
    case "IC": default: return "MID"
  }
}

export interface Attendee { userId: string; name?: string | null; role: string; seniority?: string | null }

export interface GovernanceResult {
  ok: boolean                    // no hard violations
  violations: string[]           // block scheduling unless overridden
  warnings: string[]             // allowed but flagged
  requiredSeniority: Seniority
  topPanelSeniority: Seniority | null
  panelSize: number
}

/* Evaluate a proposed interview's panel composition. Hard violations block;
 * warnings inform. `override` (admin/executive) downgrades violations to warnings. */
export function evaluatePanel(opts: {
  roleLevel?: string | null
  attendees: Attendee[]
  override?: boolean
}): GovernanceResult {
  const roleLevel = (opts.roleLevel || "IC").toUpperCase()
  const required = requiredSeniorityFor(roleLevel)
  const reqRank = seniorityRank(required)

  const assessors = opts.attendees.filter(a => ASSESSING_ROLES.includes(a.role.toUpperCase() as AttendeeRole))
  const candidates = opts.attendees.filter(a => a.role.toUpperCase() === "CANDIDATE")

  const topRank = assessors.length ? Math.max(...assessors.map(a => seniorityRank(a.seniority))) : -1
  const topPanelSeniority = topRank >= 0 ? SENIORITY[topRank] : null

  const violations: string[] = []
  const warnings: string[] = []

  if (assessors.length === 0) {
    violations.push("No interviewer on the panel — add at least one host, panelist or interviewer.")
  } else if (topRank < reqRank) {
    violations.push(
      `A ${ROLE_LEVEL_LABEL[roleLevel as RoleLevel] || roleLevel} interview needs at least a ${SENIORITY_LABEL[required]} interviewer; ` +
      `the most senior person on this panel is ${topPanelSeniority ? SENIORITY_LABEL[topPanelSeniority] : "unknown"}.`,
    )
  }

  // Executive / lead searches are best run by more than one assessor.
  if ((roleLevel === "EXECUTIVE" || roleLevel === "LEAD") && assessors.length < 2) {
    warnings.push(`${ROLE_LEVEL_LABEL[roleLevel as RoleLevel]} interviews are usually run by a panel of two or more — consider adding another interviewer.`)
  }
  if (candidates.length > 1 && opts.roleLevel && roleLevel !== "IC") {
    warnings.push("More than one candidate is booked into a senior interview — confidential discussion is limited.")
  }

  const hardViolations = opts.override ? [] : violations
  if (opts.override && violations.length) {
    warnings.push(...violations.map(v => "Overridden by an authorized approver: " + v))
  }

  return {
    ok: hardViolations.length === 0,
    violations: hardViolations,
    warnings,
    requiredSeniority: required,
    topPanelSeniority,
    panelSize: assessors.length,
  }
}

/* Who may VIEW an interview's details (list, room metadata). */
export function mayView(opts: {
  viewerId: string
  isAdmin?: boolean
  hostId: string
  visibility: string
  attendeeIds: string[]
  viewerCompanyHostIds?: string[] // host ids that share the viewer's company (for COMPANY visibility)
}): boolean {
  if (opts.isAdmin) return true
  if (opts.viewerId === opts.hostId) return true
  if (opts.attendeeIds.includes(opts.viewerId)) return true
  const vis = (opts.visibility || "PARTICIPANTS").toUpperCase()
  if (vis === "LINK") return true
  if (vis === "COMPANY" && opts.viewerCompanyHostIds?.includes(opts.hostId)) return true
  return false
}

/* Who may JOIN the live room. Stricter than view: LINK visibility lets anyone
 * with the code in, otherwise you must be an invited participant or the host. */
export function mayJoin(opts: {
  viewerId?: string | null
  isAdmin?: boolean
  hostId: string
  visibility: string
  attendeeIds: string[]
}): { allowed: boolean; reason?: string } {
  if (opts.isAdmin) return { allowed: true }
  const vis = (opts.visibility || "PARTICIPANTS").toUpperCase()
  if (vis === "LINK") return { allowed: true }
  if (!opts.viewerId) return { allowed: false, reason: "Sign in to join this interview." }
  if (opts.viewerId === opts.hostId) return { allowed: true }
  if (opts.attendeeIds.includes(opts.viewerId)) return { allowed: true }
  return { allowed: false, reason: "You're not on the invite list for this interview." }
}

/* Whether a given attendee may see confidential material (notes/recording). */
export function maySeeConfidential(role: string, confidential: boolean): boolean {
  if (!confidential) return true
  return role.toUpperCase() !== "OBSERVER" && role.toUpperCase() !== "CANDIDATE"
}
