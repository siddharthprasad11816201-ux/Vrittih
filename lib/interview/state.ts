/**
 * Server-authoritative state machines. PURE — legality is decided here, never by the client.
 *
 * TWO REAL DEFECTS THIS CLOSES:
 *  1. Interview.status was driven entirely by the candidate/host BROWSER: the room page set
 *     LIVE on join and COMPLETED on hang-up via an unvalidated PATCH that accepted any
 *     string. If the host's browser closed, the interview stayed LIVE forever, and
 *     CANCELLED was referenced by the UI but no code path could ever set it.
 *  2. PATCH /api/applications/status wrote whatever string the body contained — no enum, no
 *     allowed-transition check — so an application could jump straight from APPLIED to
 *     HIRED, or move backwards out of a terminal state.
 */

/* ---------------- Interview lifecycle ---------------- */

export const INTERVIEW_STATUSES = [
  "SCHEDULED", "RESCHEDULED", "LIVE", "COMPLETED", "CANCELLED", "NO_SHOW", "ABANDONED",
] as const
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number]

/** Terminal states cannot be left — an interview never "un-completes". */
export const TERMINAL_INTERVIEW: ReadonlySet<InterviewStatus> = new Set<InterviewStatus>([
  "COMPLETED", "CANCELLED", "NO_SHOW", "ABANDONED",
])

const INTERVIEW_TRANSITIONS: Record<InterviewStatus, InterviewStatus[]> = {
  SCHEDULED:   ["LIVE", "RESCHEDULED", "CANCELLED", "NO_SHOW", "ABANDONED"],
  RESCHEDULED: ["LIVE", "RESCHEDULED", "CANCELLED", "NO_SHOW", "ABANDONED"],
  // ABANDONED is how a stuck LIVE interview is reaped by the maintenance sweep.
  LIVE:        ["COMPLETED", "ABANDONED", "CANCELLED"],
  COMPLETED:   [],
  CANCELLED:   [],
  NO_SHOW:     [],
  ABANDONED:   [],
}

export function isInterviewStatus(v: any): v is InterviewStatus {
  return typeof v === "string" && (INTERVIEW_STATUSES as readonly string[]).includes(v)
}

export type TransitionCheck = { ok: true } | { ok: false; reason: string }

export function canTransitionInterview(from: string, to: string): TransitionCheck {
  if (!isInterviewStatus(from)) return { ok: false, reason: `Unknown current status "${from}".` }
  if (!isInterviewStatus(to)) return { ok: false, reason: `Unknown target status "${to}".` }
  if (from === to) return { ok: false, reason: "Interview is already in that state." }
  if (TERMINAL_INTERVIEW.has(from)) return { ok: false, reason: `"${from}" is final and cannot change.` }
  if (!INTERVIEW_TRANSITIONS[from].includes(to)) {
    return { ok: false, reason: `Cannot move an interview from ${from} to ${to}.` }
  }
  return { ok: true }
}

/** Who may perform a transition. The candidate can never mark their own interview complete. */
export type InterviewActor = "HOST" | "PANELIST" | "CANDIDATE" | "ADMIN" | "SYSTEM"

const ALLOWED_ACTORS: Record<InterviewStatus, InterviewActor[]> = {
  SCHEDULED:   ["HOST", "ADMIN", "SYSTEM"],
  RESCHEDULED: ["HOST", "ADMIN", "CANDIDATE"],
  LIVE:        ["HOST", "PANELIST", "ADMIN", "SYSTEM"],
  COMPLETED:   ["HOST", "PANELIST", "ADMIN", "SYSTEM"],
  CANCELLED:   ["HOST", "ADMIN", "CANDIDATE"],
  NO_SHOW:     ["HOST", "PANELIST", "ADMIN", "SYSTEM"],
  ABANDONED:   ["SYSTEM", "ADMIN"],
}

export function authorizeInterviewTransition(to: string, actor: InterviewActor): TransitionCheck {
  if (!isInterviewStatus(to)) return { ok: false, reason: `Unknown target status "${to}".` }
  if (!ALLOWED_ACTORS[to].includes(actor)) {
    return { ok: false, reason: `A ${actor.toLowerCase()} cannot set an interview to ${to}.` }
  }
  return { ok: true }
}

/** Both checks together — what a route should call. */
export function checkInterviewTransition(from: string, to: string, actor: InterviewActor): TransitionCheck {
  const a = authorizeInterviewTransition(to, actor)
  if (!a.ok) return a
  return canTransitionInterview(from, to)
}

/**
 * A LIVE interview whose scheduled end passed long ago is stuck (the host's browser closed
 * without ending the call). The sweep reaps it as ABANDONED rather than leaving it LIVE
 * forever.
 */
export const ABANDON_AFTER_MINUTES = 240

export function shouldAbandon(status: string, scheduledAt: Date, durationMinutes: number, now: Date): boolean {
  if (status !== "LIVE") return false
  const endedAt = scheduledAt.getTime() + Math.max(0, durationMinutes) * 60000
  return now.getTime() > endedAt + ABANDON_AFTER_MINUTES * 60000
}

/** A SCHEDULED interview nobody joined, well past its slot, is a no-show. */
export const NO_SHOW_AFTER_MINUTES = 60

export function shouldMarkNoShow(status: string, scheduledAt: Date, durationMinutes: number, now: Date): boolean {
  if (status !== "SCHEDULED" && status !== "RESCHEDULED") return false
  const endedAt = scheduledAt.getTime() + Math.max(0, durationMinutes) * 60000
  return now.getTime() > endedAt + NO_SHOW_AFTER_MINUTES * 60000
}

/* ---------------- Application pipeline ---------------- */

export const APPLICATION_STAGES = [
  "APPLIED", "SCREENING", "ASSESSMENT", "SHORTLISTED", "INTERVIEW",
  "OFFERED", "HIRED", "REJECTED", "WITHDRAWN",
] as const
export type ApplicationStage = (typeof APPLICATION_STAGES)[number]

export const TERMINAL_STAGES: ReadonlySet<ApplicationStage> = new Set<ApplicationStage>([
  "HIRED", "REJECTED", "WITHDRAWN",
])

/**
 * Forward moves plus the honest realities of hiring: a candidate can be rejected or
 * withdraw from any live stage, and a recruiter can send someone back a stage. What is NOT
 * allowed is skipping from APPLIED straight to HIRED, or resurrecting a terminal decision
 * (which needs a new application, preserving history).
 */
const STAGE_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  APPLIED:     ["SCREENING", "ASSESSMENT", "SHORTLISTED", "REJECTED", "WITHDRAWN"],
  SCREENING:   ["ASSESSMENT", "SHORTLISTED", "INTERVIEW", "APPLIED", "REJECTED", "WITHDRAWN"],
  ASSESSMENT:  ["SHORTLISTED", "INTERVIEW", "SCREENING", "REJECTED", "WITHDRAWN"],
  SHORTLISTED: ["INTERVIEW", "OFFERED", "ASSESSMENT", "REJECTED", "WITHDRAWN"],
  INTERVIEW:   ["INTERVIEW", "OFFERED", "SHORTLISTED", "REJECTED", "WITHDRAWN"],
  OFFERED:     ["HIRED", "INTERVIEW", "REJECTED", "WITHDRAWN"],
  HIRED:       [],
  REJECTED:    [],
  WITHDRAWN:   [],
}

export function isApplicationStage(v: any): v is ApplicationStage {
  return typeof v === "string" && (APPLICATION_STAGES as readonly string[]).includes(v)
}

export function canTransitionApplication(from: string, to: string): TransitionCheck {
  if (!isApplicationStage(from)) return { ok: false, reason: `Unknown current stage "${from}".` }
  if (!isApplicationStage(to)) return { ok: false, reason: `"${to}" is not a valid stage.` }
  if (TERMINAL_STAGES.has(from)) {
    return { ok: false, reason: `This application is already ${from.toLowerCase()} and cannot change.` }
  }
  // INTERVIEW -> INTERVIEW is legal (another round); every other self-transition is a no-op.
  if (from === to && to !== "INTERVIEW") return { ok: false, reason: "Application is already at that stage." }
  if (!STAGE_TRANSITIONS[from].includes(to)) {
    return { ok: false, reason: `Cannot move an application from ${from} to ${to}.` }
  }
  return { ok: true }
}

/** Only the candidate may withdraw; only the employer side may advance or reject. */
export type PipelineActor = "CANDIDATE" | "EMPLOYER" | "ADMIN" | "SYSTEM"

export function authorizeStageTransition(to: string, actor: PipelineActor): TransitionCheck {
  if (!isApplicationStage(to)) return { ok: false, reason: `"${to}" is not a valid stage.` }
  if (to === "WITHDRAWN") {
    return actor === "CANDIDATE" || actor === "ADMIN"
      ? { ok: true }
      : { ok: false, reason: "Only the candidate can withdraw an application." }
  }
  return actor === "CANDIDATE"
    ? { ok: false, reason: "Candidates cannot change their own application stage." }
    : { ok: true }
}

export function checkStageTransition(from: string, to: string, actor: PipelineActor): TransitionCheck {
  const a = authorizeStageTransition(to, actor)
  if (!a.ok) return a
  return canTransitionApplication(from, to)
}
