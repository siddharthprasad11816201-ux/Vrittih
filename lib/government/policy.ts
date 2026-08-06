/* Enterprise Government — Policy Intelligence. PURE, testable, FX-SAFE.
 *
 * Phase 11. Deterministic public-service analytics (NO external LLM): grievance/service SLA
 * health, scheme budget utilisation + reach (cost per beneficiary, per currency, never
 * summed across currencies), and service backlog hotspots. Feeds the Policy Intelligence
 * assistant, which routes recommendations through the Enterprise Brain.
 */

export const AGENCY_LEVELS = ["CENTRAL", "STATE", "LOCAL"] as const
export const SCHEME_STATUSES = ["DRAFT", "ACTIVE", "CLOSED"] as const
export const REQUEST_KINDS = ["SERVICE", "GRIEVANCE", "APPLICATION"] as const
export const REQUEST_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"] as const
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const

const DAY = 864e5
const money = (v: any) => Math.max(0, Number(v) || 0)
const CUR = (c: any) => String(c || "CHF").toUpperCase()
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0

export interface RequestLite { kind: string; status: string; priority?: string; category?: string | null; slaDays?: number; createdAt?: any; resolvedAt?: any }
export interface GrievanceSLA {
  total: number; open: number; resolved: number; rejected: number
  overdue: number                 // open past its SLA window
  breachRate: number              // overdue / open (%)
  resolutionRate: number          // resolved / total (%)
  avgResolutionDays: number | null
  band: "healthy" | "watch" | "breached"
}

/* Grievance/service SLA health — open items past their slaDays are overdue. */
export function grievanceSLA(requests: RequestLite[], now = Date.now()): GrievanceSLA {
  let open = 0, resolved = 0, rejected = 0, overdue = 0, resSum = 0, resN = 0
  for (const r of requests) {
    const isOpen = r.status === "OPEN" || r.status === "IN_PROGRESS"
    if (isOpen) { open++; const created = r.createdAt ? +new Date(r.createdAt) : now; const sla = Math.max(1, r.slaDays ?? 15); if (Number.isFinite(created) && now - created > sla * DAY) overdue++ }
    else if (r.status === "RESOLVED") { resolved++; if (r.createdAt && r.resolvedAt) { const a = +new Date(r.createdAt), b = +new Date(r.resolvedAt); if (Number.isFinite(a) && Number.isFinite(b) && b >= a) { resSum += (b - a) / DAY; resN++ } } }
    else if (r.status === "REJECTED") rejected++
  }
  const total = requests.length
  const breachRate = pct(overdue, open)
  const band: GrievanceSLA["band"] = breachRate >= 30 || overdue > 20 ? "breached" : breachRate >= 10 || overdue > 5 ? "watch" : "healthy"
  return { total, open, resolved, rejected, overdue, breachRate, resolutionRate: pct(resolved, total), avgResolutionDays: resN ? round2(resSum / resN) : null, band }
}

export interface SchemeLite { name?: string; budget: number; currency: string; beneficiaries: number; status?: string }
export interface SchemeReach { currency: string; schemes: number; budget: number; beneficiaries: number; costPerBeneficiary: number | null }
/* Scheme budget + reach per currency (cost per beneficiary). FX-safe: never merges currencies. */
export function schemeReach(schemes: SchemeLite[]): SchemeReach[] {
  const map = new Map<string, { budget: number; beneficiaries: number; schemes: number }>()
  for (const s of schemes) {
    if (s.status === "DRAFT") continue
    const k = CUR(s.currency); const e = map.get(k) || { budget: 0, beneficiaries: 0, schemes: 0 }
    e.budget += money(s.budget); e.beneficiaries += Math.max(0, Math.round(s.beneficiaries || 0)); e.schemes++; map.set(k, e)
  }
  return [...map.entries()].map(([currency, e]) => ({ currency, schemes: e.schemes, budget: round2(e.budget), beneficiaries: e.beneficiaries, costPerBeneficiary: e.beneficiaries > 0 ? round2(e.budget / e.beneficiaries) : null })).sort((a, b) => b.budget - a.budget)
}

export interface Backlog { byKind: Record<string, number>; byPriority: Record<string, number>; urgentOpen: number; totalOpen: number }
/* Open service/grievance backlog by kind + priority. */
export function serviceBacklog(requests: RequestLite[]): Backlog {
  const byKind: Record<string, number> = { SERVICE: 0, GRIEVANCE: 0, APPLICATION: 0 }
  const byPriority: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 }
  let urgentOpen = 0, totalOpen = 0
  for (const r of requests) {
    if (r.status !== "OPEN" && r.status !== "IN_PROGRESS") continue
    totalOpen++
    byKind[(REQUEST_KINDS as readonly string[]).includes(r.kind) ? r.kind : "SERVICE"]++
    const p = (PRIORITIES as readonly string[]).includes(r.priority || "") ? r.priority! : "MEDIUM"
    byPriority[p]++; if (p === "URGENT") urgentOpen++
  }
  return { byKind, byPriority, urgentOpen, totalOpen }
}

// ---- Evidence brief for the Enterprise Brain (Policy Intelligence) ----
import type { Brief } from "@/lib/intelligence/deliberate"
/* Build an evidence Brief a policy director would weigh, for deliberate(). */
export function policyBrief(sla: GrievanceSLA, backlog: Backlog, reach: SchemeReach[]): Brief {
  const evidence: Brief["evidence"] = []
  if (sla.overdue > 0) evidence.push({ id: "sla-overdue", statement: `${sla.overdue} request(s) past SLA (${sla.breachRate}% breach)`, stance: "oppose", weight: Math.min(0.9, 0.4 + sla.overdue * 0.03), source: "citizen-requests" })
  if (sla.resolutionRate >= 70) evidence.push({ id: "res-rate", statement: `Resolution rate ${sla.resolutionRate}%`, stance: "support", weight: 0.6, source: "citizen-requests" })
  else if (sla.total >= 5) evidence.push({ id: "res-rate-low", statement: `Low resolution rate ${sla.resolutionRate}%`, stance: "oppose", weight: 0.5, source: "citizen-requests" })
  if (backlog.urgentOpen > 0) evidence.push({ id: "urgent", statement: `${backlog.urgentOpen} urgent open request(s)`, stance: "oppose", weight: 0.7, source: "backlog" })
  for (const r of reach) if (r.costPerBeneficiary != null) evidence.push({ id: `reach-${r.currency}`, statement: `${r.currency}: ${r.beneficiaries.toLocaleString()} beneficiaries at ${r.currency} ${r.costPerBeneficiary.toLocaleString()}/head`, stance: "support", weight: 0.4, source: "schemes" })
  return {
    role: "policy director",
    question: "Is public-service delivery on track?",
    context: [`${sla.total} citizen requests`, `${backlog.totalOpen} open`, `${reach.length} funded currency pool(s)`],
    evidence,
    criteria: [
      { key: "sla", label: "SLA adherence", weight: 0.5, score: sla.open > 0 ? Math.max(0, 1 - sla.breachRate / 100) : 1 },
      { key: "resolution", label: "Resolution rate", weight: 0.3, score: sla.resolutionRate / 100 },
      { key: "urgency", label: "Urgent-queue control", weight: 0.2, score: backlog.urgentOpen === 0 ? 1 : Math.max(0, 1 - backlog.urgentOpen / 10) },
    ],
  }
}
