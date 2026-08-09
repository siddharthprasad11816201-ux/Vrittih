/* §4/§10/§29/§35 — course access decision (single source of truth). Pure.
 * FREE courses: anyone signed in can self-enrol. PAID courses: enrolment requires
 * a granted access record (paid or waived) or being the author; non-holders can
 * still read lessons explicitly marked as previews (freemium §10). */
export type CourseAccess = { accessType: string; priceCHF: number }
export type EnrollmentLike = { accessSource?: string } | null | undefined

export function isPaid(course: CourseAccess): boolean {
  return course.accessType === "PAID" && (course.priceCHF || 0) > 0
}

/** True when the user may enrol WITHOUT a payment/waiver step. */
export function canEnrolFree(course: CourseAccess, opts: { isAuthor?: boolean; enrollment?: EnrollmentLike }): boolean {
  if (opts.isAuthor) return true          // authors always have access to their own course
  if (!isPaid(course)) return true        // free course
  return !!opts.enrollment                // already granted (paid/waived earlier)
}

/** True when a lesson's protected content should be delivered to this user. */
export function lessonReadable(course: CourseAccess, lesson: { isPreview?: boolean }, hasAccess: boolean): boolean {
  if (hasAccess) return true
  return !isPaid(course) ? true : !!lesson.isPreview   // paid course, no access → previews only
}
