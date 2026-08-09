/* Phase 14 — Digital Twin simulators. PURE + testable. Composes the existing
 * planning primitives (lib/planning/workforce) and project forecaster
 * (lib/project/intelligence) — no duplicated math. Every output is deterministic
 * and honest (no fabricated numbers). */
import { budgetProjection, type BudgetProjection } from "@/lib/planning/workforce"
import { forecastCompletion } from "@/lib/project/intelligence"

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// ---- Organisation twin ----
export interface OrgSnapshot {
  headcount: number
  byDepartment: { dept: string; count: number }[]
  annualAttritionPct: number
  monthlyHiresAvg: number
  avgAnnualCostCHF: number   // 0 when no salary data (sim then uses an explicit default)
}
export interface OrgSimParams {
  hiresPerMonth: number
  attritionRatePct: number   // ANNUAL attrition %
  months: number
  avgAnnualCostCHF?: number
  costPerHireCHF?: number
}
export interface OrgSimResult {
  months: number
  projected: { month: number; headcount: number; hires: number; exits: number }[]
  endHeadcount: number
  netChange: number
  budget: BudgetProjection
  costAssumed: boolean       // true when a default avg cost was used (no salary data)
}

/* Month-by-month: headcount = prev − (prev × monthly attrition) + hires. Budget reuses
 * budgetProjection over the per-month hires. */
export function simulateOrg(snap: OrgSnapshot, params: OrgSimParams): OrgSimResult {
  const months = clamp(Math.round(params.months || 12), 1, 60)
  const monthlyAttr = Math.max(0, params.attritionRatePct || 0) / 100 / 12
  const hires = Math.max(0, Math.round(params.hiresPerMonth || 0))
  const avgAnnualCost = params.avgAnnualCostCHF && params.avgAnnualCostCHF > 0 ? params.avgAnnualCostCHF : (snap.avgAnnualCostCHF > 0 ? snap.avgAnnualCostCHF : 90000)
  const costAssumed = !(params.avgAnnualCostCHF && params.avgAnnualCostCHF > 0) && !(snap.avgAnnualCostCHF > 0)

  let head = Math.max(0, Math.round(snap.headcount))
  const projected: OrgSimResult["projected"] = []
  const ramp = []
  for (let i = 1; i <= months; i++) {
    const exits = Math.round(head * monthlyAttr)
    const next = Math.max(0, head - exits + hires)
    projected.push({ month: i, headcount: next, hires, exits })
    ramp.push({ month: i, planned: next, hires })
    head = next
  }
  const budget = budgetProjection(ramp, { costPerHire: params.costPerHireCHF ?? 8000, avgAnnualCost, currency: "CHF" })
  const endHeadcount = projected.length ? projected[projected.length - 1].headcount : snap.headcount
  return { months, projected, endHeadcount, netChange: endHeadcount - snap.headcount, budget, costAssumed }
}

// ---- Project twin ----
export interface ProjectSnapshot {
  openTasks: number
  perWeek: number         // measured weekly completion velocity
  etaWeeks: number | null
  teamSize: number
}
export interface ProjectSimParams { addPeople: number; extraTasks: number }
export interface ProjectSimResult {
  openTasks: number
  perWeek: number
  etaWeeks: number | null
  etaAt: number | null
  confidence: number
  deltaWeeks: number | null   // change vs the baseline ETA (− = faster)
}

/* What-if: add people (velocity scales with team size, linear proxy) and/or scope
 * (extra tasks), then re-forecast completion with the existing forecaster. */
export function simulateProject(snap: ProjectSnapshot, params: ProjectSimParams): ProjectSimResult {
  const newTeam = Math.max(1, snap.teamSize + Math.round(params.addPeople || 0))
  const perPerson = snap.teamSize > 0 ? snap.perWeek / snap.teamSize : snap.perWeek
  const newPerWeek = +(perPerson * newTeam).toFixed(2)
  const newOpen = Math.max(0, snap.openTasks + Math.round(params.extraTasks || 0))
  const f = forecastCompletion(newOpen, newPerWeek)
  const deltaWeeks = snap.etaWeeks != null && f.weeksRemaining != null ? +(f.weeksRemaining - snap.etaWeeks).toFixed(1) : null
  return { openTasks: newOpen, perWeek: newPerWeek, etaWeeks: f.weeksRemaining, etaAt: f.etaAt, confidence: f.confidence, deltaWeeks }
}
