/**
 * What "fully registered" means, in one place. PURE — no I/O.
 *
 * Viewing a job is public: a shared link must open for anyone, signed in or not. APPLYING
 * is different — it creates a real record against a real employer's pipeline, so it
 * requires an account that has been verified and completed.
 *
 * The bar is deliberately modest. It exists to stop throwaway and unverified applications,
 * not to gate people out of work: a verified email, a real name, and enough profile for an
 * employer to evaluate them. Anything stricter would punish the candidate rather than the
 * spammer.
 *
 * Every check returns WHAT IS MISSING and WHERE TO FIX IT, so the UI can show a checklist
 * instead of a dead end.
 */

export interface RegistrationSubject {
  id?: string | null
  name?: string | null
  email?: string | null
  emailVerified?: Date | string | null
  headline?: string | null
  location?: string | null
  /** Number of skills on the profile. */
  skillCount?: number
  /** Number of experience entries. */
  experienceCount?: number
  /** Number of education entries. */
  educationCount?: number
  resumeUrl?: string | null
}

export type RequirementKey = "signed_in" | "email_verified" | "name" | "profile_basics" | "evidence"

/**
 * Email verification is OFF by default.
 *
 * The machinery is built and tested, but enforcing it while SMTP is unconfigured would lock
 * every new user out of applying — the code would be created and never delivered. So it is
 * opt-in: set REQUIRE_EMAIL_VERIFICATION=true once mail is actually sending, and the
 * requirement appears in the checklist and starts being enforced with no code change.
 */
export function emailVerificationRequired(): boolean {
  return String(process.env.REQUIRE_EMAIL_VERIFICATION || "").toLowerCase() === "true"
}

export interface Requirement {
  key: RequirementKey
  label: string
  met: boolean
  /** Where the user goes to satisfy it. */
  href: string
  /** Shown when unmet — says what to do, not merely what is wrong. */
  hint: string
}

export interface RegistrationStatus {
  /** True only when every requirement is met. */
  complete: boolean
  signedIn: boolean
  requirements: Requirement[]
  missing: RequirementKey[]
  /** 0..1 — for a progress indicator. */
  progress: number
  /** One-line summary suitable for an API error or a banner. */
  summary: string
}

/**
 * Evaluate an account against the apply bar.
 * Passing `null` (anonymous) returns the same shape, so callers never branch on null.
 */
export function registrationStatus(user: RegistrationSubject | null | undefined): RegistrationStatus {
  const signedIn = !!user?.id

  const hasName = !!(user?.name && user.name.trim().length >= 2)
  const verified = !!user?.emailVerified
  const hasBasics = !!(user?.headline && user.headline.trim()) && !!(user?.location && user.location.trim())
  // "Evidence" = something an employer can actually assess. Any ONE of these is enough;
  // requiring all three would exclude career changers and first-time applicants.
  const hasEvidence =
    (user?.skillCount ?? 0) > 0 ||
    (user?.experienceCount ?? 0) > 0 ||
    (user?.educationCount ?? 0) > 0 ||
    !!user?.resumeUrl

  const requireVerification = emailVerificationRequired()

  const requirements: Requirement[] = [
    {
      key: "signed_in",
      label: "Sign in to your account",
      met: signedIn,
      href: "/login",
      hint: "Applications are recorded against your account, so you need to be signed in.",
    },
    {
      key: "email_verified",
      label: "Verify your email address",
      met: signedIn && verified,
      href: "/account?verify=email",
      hint: "We send interview invitations and decisions by email, so it has to be a real address you control.",
    },
    {
      key: "name",
      label: "Add your full name",
      met: signedIn && hasName,
      href: "/profile/edit",
      hint: "Employers see your name on the application.",
    },
    {
      key: "profile_basics",
      label: "Add your headline and location",
      met: signedIn && hasBasics,
      href: "/profile/edit",
      hint: "A one-line headline and where you are based — employers filter on both.",
    },
    {
      key: "evidence",
      label: "Add skills, experience, education or a résumé",
      met: signedIn && hasEvidence,
      href: "/profile/edit",
      hint: "At least one of these, so an employer has something to assess.",
    },
  ]

  // Filtered rather than conditionally pushed, so the ORDER of the checklist stays stable
  // whichever way the flag is set.
  const active = requirements.filter((r) => r.key !== "email_verified" || requireVerification)

  const missing = active.filter((r) => !r.met).map((r) => r.key)
  const met = active.length - missing.length

  return {
    complete: missing.length === 0,
    signedIn,
    requirements: active,
    missing,
    progress: +(met / active.length).toFixed(2),
    summary: !signedIn
      ? "Sign in to apply."
      : missing.length === 0
        ? "Your account is ready to apply."
        : missing.length === 1
          ? `One step left: ${active.find((r) => !r.met)!.label.toLowerCase()}.`
          : `${missing.length} steps left before you can apply.`,
  }
}

/** Shape a refusal for the API, so the client can render the checklist rather than a toast. */
export function applyBlockedResponse(status: RegistrationStatus) {
  return {
    error: status.summary,
    code: status.signedIn ? "REGISTRATION_INCOMPLETE" : "NOT_AUTHENTICATED",
    registration: {
      complete: status.complete,
      progress: status.progress,
      missing: status.missing,
      steps: status.requirements.filter((r) => !r.met).map((r) => ({ key: r.key, label: r.label, href: r.href, hint: r.hint })),
    },
  }
}
