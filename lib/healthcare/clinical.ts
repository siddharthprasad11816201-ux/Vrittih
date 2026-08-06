/* Enterprise Healthcare — Clinical Operations Intelligence. PURE, testable.
 *
 * Phase 12. Deterministic OPERATIONAL analytics (NO external LLM, and explicitly NOT
 * clinical diagnosis or medical advice): appointment load + no-show rate, population-health
 * distributions, records coverage, and triage ROUTING (operational urgency from explicit
 * presenting-complaint keywords — a queue-priority aid a triage nurse confirms, never a
 * diagnosis). Feeds the Clinical Operations Assistant via the Enterprise Brain.
 */

export const APPOINTMENT_STATUSES = ["SCHEDULED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"] as const
export const RECORD_KINDS = ["VISIT", "LAB", "DIAGNOSIS", "PRESCRIPTION"] as const
export const TRIAGE_LEVELS = ["ROUTINE", "PRIORITY", "URGENT"] as const

const DAY = 864e5
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0

export interface ApptLite { status: string; scheduledAt?: any }
export interface ApptStats {
  total: number; scheduled: number; completed: number; cancelled: number; noShow: number
  upcoming7d: number
  noShowRate: number          // no_show / (completed + no_show), %
  completionRate: number
  band: "healthy" | "watch" | "high-no-show"
}
/* Appointment throughput + no-show rate (of finished appointments). */
export function appointmentStats(appts: ApptLite[], now = Date.now()): ApptStats {
  let scheduled = 0, completed = 0, cancelled = 0, noShow = 0, upcoming7d = 0
  for (const a of appts) {
    if (a.status === "SCHEDULED" || a.status === "CHECKED_IN") { scheduled++; const t = a.scheduledAt ? +new Date(a.scheduledAt) : NaN; if (Number.isFinite(t) && t >= now && t - now <= 7 * DAY) upcoming7d++ }
    else if (a.status === "COMPLETED") completed++
    else if (a.status === "CANCELLED") cancelled++
    else if (a.status === "NO_SHOW") noShow++
  }
  const finished = completed + noShow
  const noShowRate = pct(noShow, finished)
  const band: ApptStats["band"] = noShowRate >= 20 ? "high-no-show" : noShowRate >= 10 ? "watch" : "healthy"
  return { total: appts.length, scheduled, completed, cancelled, noShow, upcoming7d, noShowRate, completionRate: pct(completed, finished), band }
}

export interface PatientLite { dob?: any; bloodGroup?: string | null }
export interface PopulationHealth { patients: number; ageBands: Record<string, number>; bloodGroups: Record<string, number>; medianAgeBand: string | null }
/* Population distributions (age bands, blood groups) — operational demographics only. */
export function populationHealth(patients: PatientLite[], now = Date.now()): PopulationHealth {
  const ageBands: Record<string, number> = { "0-17": 0, "18-34": 0, "35-49": 0, "50-64": 0, "65+": 0, unknown: 0 }
  const bloodGroups: Record<string, number> = {}
  for (const p of patients) {
    const t = p.dob ? +new Date(p.dob) : NaN
    if (!Number.isFinite(t)) ageBands.unknown++
    else { const age = Math.floor((now - t) / (365.25 * DAY)); ageBands[age < 18 ? "0-17" : age < 35 ? "18-34" : age < 50 ? "35-49" : age < 65 ? "50-64" : "65+"]++ }
    const bg = (p.bloodGroup || "unknown").toUpperCase(); bloodGroups[bg] = (bloodGroups[bg] || 0) + 1
  }
  const known = Object.entries(ageBands).filter(([k]) => k !== "unknown").sort((a, b) => b[1] - a[1])
  return { patients: patients.length, ageBands, bloodGroups, medianAgeBand: known[0] && known[0][1] > 0 ? known[0][0] : null }
}

/* Triage ROUTING (operational queue priority from explicit red-flag keywords in the
 * presenting complaint). NOT a diagnosis — a nurse confirms. Conservative: only well-known
 * emergency phrases escalate. */
const URGENT_KW = ["chest pain", "difficulty breathing", "shortness of breath", "severe bleeding", "unconscious", "stroke", "seizure", "anaphylaxis", "suicidal", "severe burn", "cardiac"]
const PRIORITY_KW = ["fracture", "high fever", "persistent vomiting", "dehydration", "severe pain", "infection", "pregnan", "asthma"]
export function triageRouting(complaint: string): { level: "ROUTINE" | "PRIORITY" | "URGENT"; matched: string[]; note: string } {
  const c = String(complaint || "").toLowerCase()
  const u = URGENT_KW.filter(k => c.includes(k)); if (u.length) return { level: "URGENT", matched: u, note: "Emergency red-flag phrase present — route to immediate assessment (nurse to confirm)." }
  const p = PRIORITY_KW.filter(k => c.includes(k)); if (p.length) return { level: "PRIORITY", matched: p, note: "Priority indicator present — expedite (nurse to confirm)." }
  return { level: "ROUTINE", matched: [], note: "No red-flag phrase detected — routine queue (operational routing only)." }
}

// ---- Evidence brief for the Enterprise Brain (Clinical Operations) ----
import type { Brief } from "@/lib/intelligence/deliberate"
export function clinicalOpsBrief(stats: ApptStats, pop: PopulationHealth, recordsCoverage: number): Brief {
  const evidence: Brief["evidence"] = []
  if (stats.noShowRate >= 20) evidence.push({ id: "noshow", statement: `High no-show rate ${stats.noShowRate}%`, stance: "oppose", weight: 0.7, source: "appointments" })
  else if (stats.completed > 0) evidence.push({ id: "noshow-ok", statement: `No-show rate ${stats.noShowRate}% within tolerance`, stance: "support", weight: 0.5, source: "appointments" })
  if (stats.completionRate >= 80) evidence.push({ id: "completion", statement: `Completion rate ${stats.completionRate}%`, stance: "support", weight: 0.5, source: "appointments" })
  if (recordsCoverage < 60 && pop.patients > 0) evidence.push({ id: "records", statement: `Only ${recordsCoverage}% of patients have a medical record`, stance: "oppose", weight: 0.4, source: "records" })
  return {
    role: "clinical operations lead",
    question: "Are clinic operations running smoothly? (operational, not clinical advice)",
    context: [`${pop.patients} patients`, `${stats.total} appointments`, `${stats.upcoming7d} upcoming this week`],
    evidence,
    criteria: [
      { key: "attendance", label: "Attendance (low no-show)", weight: 0.5, score: Math.max(0, 1 - stats.noShowRate / 100) },
      { key: "completion", label: "Completion rate", weight: 0.3, score: stats.completionRate / 100 },
      { key: "records", label: "Records coverage", weight: 0.2, score: Math.min(1, recordsCoverage / 100) },
    ],
  }
}
