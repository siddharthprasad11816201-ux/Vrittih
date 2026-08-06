/* Enterprise University OS — Campus Intelligence. PURE, testable.
 *
 * Phase 8. Deterministic academic analytics (NO external LLM): the admissions funnel and
 * yield, seat utilisation, placement rate, GPA distribution, at-risk students, and the
 * student:faculty ratio. Feeds the Campus Intelligence assistant (lib/aios). No external
 * services.
 */

export const ADMISSION_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "OFFERED", "ACCEPTED", "REJECTED", "WAITLISTED"] as const
export const PROGRAM_LEVELS = ["UG", "PG", "PHD", "DIPLOMA"] as const
export const STUDENT_STATUSES = ["ACTIVE", "GRADUATED", "DROPPED"] as const

const clamp0 = (n: any) => Math.max(0, Number(n) || 0)
const pct = (num: number, den: number) => den > 0 ? Math.round((num / den) * 100) : 0

export interface AdmissionLite { status: string; score?: number | null }
export interface AdmissionsFunnel {
  total: number
  byStatus: Record<string, number>
  offerRate: number       // offered (+accepted) / total applications
  yield: number           // accepted / (offered + accepted) — offer acceptance
  admitted: number        // ACCEPTED
  avgAdmittedScore: number | null
}

/* Admissions funnel + yield. "Offered" counts anyone who received an offer (OFFERED or
 * later ACCEPTED); yield is how many offers converted to acceptances. */
export function admissionsFunnel(apps: AdmissionLite[]): AdmissionsFunnel {
  const byStatus: Record<string, number> = Object.fromEntries(ADMISSION_STATUSES.map(s => [s, 0]))
  let scoreSum = 0, scoreN = 0
  for (const a of apps) { const s = (ADMISSION_STATUSES as readonly string[]).includes(a.status) ? a.status : "SUBMITTED"; byStatus[s]++; if (s === "ACCEPTED" && a.score != null) { scoreSum += clamp0(a.score); scoreN++ } }
  const total = apps.length
  const accepted = byStatus.ACCEPTED
  const offeredTotal = byStatus.OFFERED + accepted   // everyone who got an offer
  return {
    total, byStatus,
    offerRate: pct(offeredTotal, total),
    yield: pct(accepted, offeredTotal),
    admitted: accepted,
    avgAdmittedScore: scoreN ? Math.round((scoreSum / scoreN) * 10) / 10 : null,
  }
}

export interface ProgramLite { id?: string; name?: string; seats: number }
export interface SeatUtil { seats: number; enrolled: number; utilization: number; open: number }
/* Seat utilisation across programs (enrolled active students vs total seats). */
export function seatUtilization(programs: ProgramLite[], activeEnrolled: number): SeatUtil {
  const seats = programs.reduce((a, p) => a + clamp0(p.seats), 0)
  const enrolled = clamp0(activeEnrolled)
  return { seats, enrolled, utilization: pct(enrolled, seats), open: Math.max(0, seats - enrolled) }
}

export interface StudentLite { status: string; gpa?: number | null; placed?: boolean; year?: number }
export interface PlacementStats { eligible: number; placed: number; rate: number }
/* Placement rate over final-year + graduated students (the placement-eligible cohort). */
export function placementStats(students: StudentLite[], finalYear = 4): PlacementStats {
  const eligibleList = students.filter(s => s.status === "GRADUATED" || (s.status === "ACTIVE" && (s.year || 0) >= finalYear))
  const placed = eligibleList.filter(s => s.placed).length
  return { eligible: eligibleList.length, placed, rate: pct(placed, eligibleList.length) }
}

export interface GpaDistribution { count: number; avg: number | null; bands: { excellent: number; good: number; average: number; atRisk: number } }
/* GPA distribution (on a 0–10 scale) over students who have a GPA. */
export function gpaDistribution(students: StudentLite[]): GpaDistribution {
  const withGpa = students.filter(s => s.gpa != null)
  let sum = 0
  const bands = { excellent: 0, good: 0, average: 0, atRisk: 0 }
  for (const s of withGpa) {
    const g = clamp0(s.gpa); sum += g
    if (g >= 8.5) bands.excellent++
    else if (g >= 7) bands.good++
    else if (g >= 5) bands.average++
    else bands.atRisk++
  }
  return { count: withGpa.length, avg: withGpa.length ? Math.round((sum / withGpa.length) * 100) / 100 : null, bands }
}

/* At-risk = active students with a GPA below the threshold (default 5.0 / 10). */
export function atRiskStudents<T extends StudentLite>(students: T[], threshold = 5): T[] {
  return students.filter(s => s.status === "ACTIVE" && s.gpa != null && clamp0(s.gpa) < threshold)
}

export interface FacultyRatio { students: number; faculty: number; ratio: number | null; band: "healthy" | "watch" | "stretched" }
/* Student:faculty ratio. >25:1 is stretched, >18:1 is watch (typical HE benchmarks). */
export function facultyRatio(activeStudents: number, facultyCount: number): FacultyRatio {
  const students = clamp0(activeStudents), faculty = clamp0(facultyCount)
  const ratio = faculty > 0 ? Math.round((students / faculty) * 10) / 10 : null
  const band: FacultyRatio["band"] = ratio == null ? "watch" : ratio > 25 ? "stretched" : ratio > 18 ? "watch" : "healthy"
  return { students, faculty, ratio, band }
}

// ---- Campus advisor ----
export type Severity = "urgent" | "high" | "medium" | "low"
const SEV: Record<Severity, number> = { urgent: 4, high: 3, medium: 2, low: 1 }
export interface CampusSuggestion { id: string; title: string; detail: string; severity: Severity; action: { label: string; href: string } }
export interface CampusAdvice { summary: string; suggestions: CampusSuggestion[] }

export function campusAdvisor(input: { funnel: AdmissionsFunnel; seats: SeatUtil; placement: PlacementStats; gpa: GpaDistribution; atRisk: number; ratio: FacultyRatio }): CampusAdvice {
  const s: CampusSuggestion[] = []
  if (input.atRisk > 0) s.push({ id: "at-risk", title: `${input.atRisk} student(s) academically at risk`, detail: `${input.atRisk} active student(s) are below a 5.0 GPA — flag for mentoring before results finalise.`, severity: input.atRisk > 10 ? "urgent" : "high", action: { label: "View students", href: "/university" } })
  if (input.ratio.band === "stretched") s.push({ id: "ratio", title: `Student:faculty ratio is ${input.ratio.ratio}:1`, detail: `Teaching load is stretched — consider recruiting faculty or capping intake.`, severity: "high", action: { label: "View faculty", href: "/university" } })
  if (input.funnel.total >= 10 && input.funnel.yield < 40 && input.funnel.byStatus.OFFERED > 0) s.push({ id: "yield", title: `Offer yield is ${input.funnel.yield}%`, detail: `Fewer than half of offers convert — follow up with offered applicants and revisit scholarships.`, severity: "medium", action: { label: "View admissions", href: "/university" } })
  if (input.seats.seats > 0 && input.seats.utilization < 70) s.push({ id: "seats", title: `${input.seats.open} seat(s) unfilled`, detail: `Seat utilisation is ${input.seats.utilization}% — open a later admission round or waitlist conversion.`, severity: "medium", action: { label: "View programs", href: "/university" } })
  if (input.placement.eligible >= 5 && input.placement.rate < 60) s.push({ id: "placement", title: `Placement rate is ${input.placement.rate}%`, detail: `${input.placement.eligible - input.placement.placed} eligible student(s) are unplaced — activate employer outreach.`, severity: "medium", action: { label: "View placement", href: "/university" } })
  s.sort((a, b) => SEV[b.severity] - SEV[a.severity])
  const urgent = s.filter(x => x.severity === "urgent").length
  return { summary: s.length === 0 ? "Campus operations look healthy — no pressing actions." : `${s.length} recommendation${s.length > 1 ? "s" : ""}${urgent ? `, ${urgent} urgent` : ""}.`, suggestions: s }
}
