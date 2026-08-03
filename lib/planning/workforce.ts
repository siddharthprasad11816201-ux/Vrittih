/* Strategic Workforce Planning — deterministic planning math. PURE, testable.
 *
 * EROS Module 1. Reuses lib/intelligence/forecast for demand forecasting (done in the
 * API over real hiring series); this module owns the deterministic planning arithmetic:
 * headcount ramp to a target, compounding growth scenarios, and budget projection.
 * FX-safe — money carries an explicit currency and is never summed across currencies.
 */

export interface RampStep { month: number; planned: number; hires: number }

/* Linear headcount ramp from `current` to `target` over `months` (hires this month =
 * the step up). Never negative hires (a shrink plans 0 hires, target still tracked). */
export function headcountRamp(current: number, target: number, months: number): RampStep[] {
  const m = Math.max(1, Math.round(months))
  const cur = Math.max(0, Math.round(current))
  const tgt = Math.max(0, Math.round(target))
  const steps: RampStep[] = []
  let prev = cur
  for (let i = 1; i <= m; i++) {
    const planned = Math.round(cur + ((tgt - cur) * i) / m)
    steps.push({ month: i, planned, hires: Math.max(0, planned - prev) })
    prev = planned
  }
  return steps
}

/* Compounding growth scenario: project headcount forward at a monthly growth rate (%). */
export function scenarioHeadcount(current: number, monthlyGrowthPct: number, months: number): number[] {
  const m = Math.max(1, Math.round(months))
  const r = monthlyGrowthPct / 100
  const out: number[] = []
  let h = Math.max(0, current)
  for (let i = 0; i < m; i++) { h = h * (1 + r); out.push(Math.round(h)) }
  return out
}

export interface BudgetProjection {
  currency: string
  totalHires: number
  hiringCost: number          // one-off cost-per-hire × hires
  annualisedPayroll: number   // added headcount × avg annual cost (run-rate at end)
  byMonth: { month: number; hires: number; cumulativePayroll: number }[]
}

/* Budget from a ramp: one-off hiring cost + the annualised payroll run-rate the added
 * headcount creates. All figures in a single explicit currency. */
export function budgetProjection(ramp: RampStep[], opts: { costPerHire: number; avgAnnualCost: number; currency: string }): BudgetProjection {
  const totalHires = ramp.reduce((a, s) => a + s.hires, 0)
  const hiringCost = totalHires * Math.max(0, opts.costPerHire)
  let cumHeads = 0
  const byMonth = ramp.map(s => {
    cumHeads += s.hires
    return { month: s.month, hires: s.hires, cumulativePayroll: Math.round(cumHeads * (opts.avgAnnualCost / 12)) }
  })
  return {
    currency: opts.currency || "CHF",
    totalHires,
    hiringCost: Math.round(hiringCost),
    annualisedPayroll: Math.round(cumHeads * opts.avgAnnualCost),
    byMonth,
  }
}

/* Turn a demand forecast (next-period hire counts) into a hiring plan with lead time —
 * i.e. how many to START sourcing now given a time-to-hire in months. */
export function hiringPlanFromDemand(forecastHires: number[], timeToHireMonths: number): { period: number; demand: number; startSourcing: number }[] {
  const lead = Math.max(0, Math.round(timeToHireMonths))
  return forecastHires.map((demand, i) => ({
    period: i + 1,
    demand: Math.max(0, Math.round(demand)),
    // to have `demand` ready in period i+1, start sourcing `lead` periods earlier
    startSourcing: Math.max(0, Math.round(forecastHires[i + lead] ?? demand)),
  }))
}
