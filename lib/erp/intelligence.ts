/* Financial Intelligence — AR aging, cash-flow projection, burn/runway, budget forecast.
 * PURE, testable, and FX-SAFE.
 *
 * Phase 6. In-house, deterministic (NO external LLM). EVERYTHING is grouped by currency
 * and NEVER summed across currencies — each function returns per-currency rows. Turning a
 * multi-currency book into one number is a separate, explicit step (lib/fx). Feeds the
 * finance advisor (lib/aios ops-providers).
 */

const DAY = 864e5
const ts = (d: any): number | null => { if (d == null) return null; const n = +new Date(d); return Number.isFinite(n) ? n : null }
const CUR = (c: any) => String(c || "CHF").toUpperCase()
const money = (v: any) => Math.max(0, Number(v) || 0)

export interface InvLite { amount: number; currency: string; status: string; dueAt?: any; createdAt?: any }
export interface ExpLite { amount: number; currency: string; status: string; category?: string; createdAt?: any }
export interface BudLite { category: string; amount: number; currency: string }

// ---- AR aging (receivables owed to us: SENT + OVERDUE) ----
export interface Aging { currency: string; current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; total: number; count: number }

/* Bucket outstanding invoices by how far past due (or past issue, if no due date) they are. */
export function arAging(invoices: InvLite[], now = Date.now()): Aging[] {
  const map = new Map<string, Aging>()
  const get = (c: string) => { const k = CUR(c); if (!map.has(k)) map.set(k, { currency: k, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0, count: 0 }); return map.get(k)! }
  for (const inv of invoices) {
    if (inv.status !== "SENT" && inv.status !== "OVERDUE") continue
    const amt = money(inv.amount); if (amt === 0) continue
    const ref = ts(inv.dueAt) ?? ts(inv.createdAt) ?? now
    const overdueDays = Math.floor((now - ref) / DAY)
    const r = get(inv.currency)
    if (overdueDays <= 0) r.current += amt
    else if (overdueDays <= 30) r.d1_30 += amt
    else if (overdueDays <= 60) r.d31_60 += amt
    else if (overdueDays <= 90) r.d61_90 += amt
    else r.d90plus += amt
    r.total += amt; r.count++
  }
  // Derive total from the ROUNDED buckets so the report always reconciles (buckets sum == total).
  for (const r of map.values()) { r.current = round2(r.current); r.d1_30 = round2(r.d1_30); r.d31_60 = round2(r.d31_60); r.d61_90 = round2(r.d61_90); r.d90plus = round2(r.d90plus); r.total = round2(r.current + r.d1_30 + r.d31_60 + r.d61_90 + r.d90plus) }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

// ---- Burn rate (money out: APPROVED + REIMBURSED) ----
export interface Burn { currency: string; monthlyBurn: number; window: number; totalInWindow: number }

/* Average monthly outflow over a trailing window (default 3 months), per currency. */
export function burnRate(expenses: ExpLite[], now = Date.now(), months = 3): Burn[] {
  const from = now - months * 30 * DAY
  const map = new Map<string, number>()
  for (const e of expenses) {
    if (e.status !== "APPROVED" && e.status !== "REIMBURSED") continue
    const t = ts(e.createdAt) ?? now
    if (t < from || t > now) continue
    map.set(CUR(e.currency), (map.get(CUR(e.currency)) || 0) + money(e.amount))
  }
  return [...map.entries()].map(([currency, total]) => ({ currency, monthlyBurn: round2(total / months), window: months, totalInWindow: round2(total) })).sort((a, b) => b.monthlyBurn - a.monthlyBurn)
}

// ---- Receivables runway: months of burn covered by what we're owed ----
export interface Runway { currency: string; outstanding: number; monthlyBurn: number; months: number | null }

/* How many months of outflow the outstanding receivables could cover, per currency.
 * (A cash-independent liquidity proxy — we don't track a bank balance.) */
export function receivablesRunway(aging: Aging[], burn: Burn[]): Runway[] {
  const burnBy = new Map(burn.map(b => [b.currency, b.monthlyBurn]))
  const currencies = new Set([...aging.map(a => a.currency), ...burn.map(b => b.currency)])
  const out: Runway[] = []
  for (const c of currencies) {
    const outstanding = aging.find(a => a.currency === c)?.total || 0
    const mb = burnBy.get(c) || 0
    out.push({ currency: c, outstanding: round2(outstanding), monthlyBurn: mb, months: mb > 0 ? +(outstanding / mb).toFixed(1) : null })
  }
  return out.sort((a, b) => b.outstanding - a.outstanding)
}

// ---- Cash-flow projection (per currency, per week) ----
export interface CashWeek { weekIndex: number; inflow: number; outflow: number; net: number; cumulative: number }
export interface CashFlow { currency: string; weeks: CashWeek[]; projectedNet: number }

const WEEKS_PER_MONTH = 4.345

/* Weekly inflow (invoices coming due) minus REAL outflow, projected over a horizon.
 * Outflow is committed/actual money — NOT budget ceilings: (a) committed-but-unpaid expenses
 * (SUBMITTED + APPROVED) land in week 0, and (b) a forward run-rate estimated from trailing
 * REIMBURSED actuals is spread across every week. Budgets are plans, not cash, so they never
 * drive the cash projection (that would flag a brand-new budget-only account as cash-negative).
 * Per currency; overdue receivables land in week 0. */
export function cashFlowProjection(invoices: InvLite[], expenses: ExpLite[], opts?: { horizonWeeks?: number; now?: number; burnWindowMonths?: number }): CashFlow[] {
  const horizon = Math.max(1, opts?.horizonWeeks ?? 8)
  const now = opts?.now ?? Date.now()
  const burnMonths = Math.max(1, opts?.burnWindowMonths ?? 3)
  const currencies = new Set<string>()
  invoices.forEach(i => currencies.add(CUR(i.currency)))
  expenses.forEach(e => currencies.add(CUR(e.currency)))

  const from = now - burnMonths * 30 * DAY
  const out: CashFlow[] = []
  for (const cur of currencies) {
    const weeks: CashWeek[] = Array.from({ length: horizon }, (_, i) => ({ weekIndex: i, inflow: 0, outflow: 0, net: 0, cumulative: 0 }))
    // Inflow: receivables (SENT/OVERDUE) bucketed by due week; anything due in the past → week 0.
    for (const inv of invoices) {
      if (CUR(inv.currency) !== cur) continue
      if (inv.status !== "SENT" && inv.status !== "OVERDUE") continue
      const due = ts(inv.dueAt) ?? now
      const wk = Math.max(0, Math.floor((due - now) / (7 * DAY)))
      if (wk < horizon) weeks[wk].inflow += money(inv.amount)
    }
    // Outflow (a): forward run-rate from trailing REIMBURSED actuals (a proxy for ongoing burn).
    let reimbursed = 0
    for (const e of expenses) { if (CUR(e.currency) !== cur) continue; if (e.status !== "REIMBURSED") continue; const t = ts(e.createdAt) ?? now; if (t >= from && t <= now) reimbursed += money(e.amount) }
    const weeklyRunRate = (reimbursed / burnMonths) / WEEKS_PER_MONTH
    for (const w of weeks) w.outflow += weeklyRunRate
    // Outflow (b): committed-but-unpaid expenses (SUBMITTED/APPROVED) as a near-term (week 0) outflow.
    for (const e of expenses) {
      if (CUR(e.currency) !== cur) continue
      if (e.status === "SUBMITTED" || e.status === "APPROVED") weeks[0].outflow += money(e.amount)
    }
    let cum = 0
    for (const w of weeks) { w.inflow = round2(w.inflow); w.outflow = round2(w.outflow); w.net = round2(w.inflow - w.outflow); cum += w.net; w.cumulative = round2(cum) }
    out.push({ currency: cur, weeks, projectedNet: round2(cum) })
  }
  return out.sort((a, b) => b.projectedNet - a.projectedNet)
}

// ---- Budget forecast (end-of-period projection) ----
export interface BudgetForecast { category: string; budget: number; spent: number; projected: number; willExceed: boolean; overBy: number; utilization: number }

/* Project end-of-period spend from spend-to-date and how much of the period has elapsed.
 * Same-currency inputs (caller groups by currency). elapsedFraction in (0,1]. */
export function budgetForecast(budgets: { category: string; amount: number }[], spentByCategory: Record<string, number>, elapsedFraction: number): BudgetForecast[] {
  const frac = Math.min(1, Math.max(0.01, elapsedFraction || 0.01))
  return budgets.map(b => {
    const budget = money(b.amount)
    const spent = money(spentByCategory[b.category])
    const projected = round2(spent / frac)
    return { category: b.category, budget: round2(budget), spent: round2(spent), projected, willExceed: projected > budget, overBy: round2(Math.max(0, projected - budget)), utilization: budget > 0 ? Math.round((spent / budget) * 100) : 0 }
  }).sort((a, b) => (b.projected - b.budget) - (a.projected - a.budget))
}

// ---- Finance advisor: prioritised, explainable recommendations ----
export type Severity = "urgent" | "high" | "medium" | "low"
const SEV: Record<Severity, number> = { urgent: 4, high: 3, medium: 2, low: 1 }
export interface FinSuggestion { id: string; title: string; detail: string; severity: Severity; action: { label: string; href: string } }
export interface FinAdvice { summary: string; suggestions: FinSuggestion[] }

/* Deterministic finance advisor. Amounts are always stated with their currency and never
 * combined across currencies. */
export function financeAdvisor(input: { aging: Aging[]; cashflow: CashFlow[]; runway: Runway[]; budgetForecastByCurrency: Record<string, BudgetForecast[]> }, now = Date.now()): FinAdvice {
  const s: FinSuggestion[] = []
  // Overdue receivables (61d+).
  for (const a of input.aging) {
    const seriouslyLate = round2(a.d61_90 + a.d90plus)
    if (seriouslyLate > 0) s.push({ id: `overdue-${a.currency}`, title: `${a.currency} ${seriouslyLate.toLocaleString()} is 60+ days overdue`, detail: `Chase these receivables — the longer they age, the less likely they collect. ${a.currency} ${a.d90plus.toLocaleString()} is already 90+ days out.`, severity: a.d90plus > 0 ? "urgent" : "high", action: { label: "Review invoices", href: "/finance" } })
    else if (a.d31_60 > 0) s.push({ id: `aging-${a.currency}`, title: `${a.currency} ${a.d31_60.toLocaleString()} is 31–60 days overdue`, detail: `Send a reminder before these slip into the hard-to-collect band.`, severity: "medium", action: { label: "Review invoices", href: "/finance" } })
  }
  // Negative projected cash.
  for (const cf of input.cashflow) {
    const firstNeg = cf.weeks.find(w => w.cumulative < 0)
    if (firstNeg) s.push({ id: `cash-${cf.currency}`, title: `${cf.currency} cash projected negative by week ${firstNeg.weekIndex}`, detail: `Projected ${cf.currency} balance goes to ${firstNeg.cumulative.toLocaleString()} — accelerate collections or defer spend.`, severity: firstNeg.weekIndex <= 2 ? "urgent" : "high", action: { label: "Open finance", href: "/finance" } })
  }
  // Short receivables runway.
  for (const r of input.runway) {
    if (r.months != null && r.months < 1 && r.monthlyBurn > 0) s.push({ id: `runway-${r.currency}`, title: `${r.currency} receivables cover under 1 month of spend`, detail: `Outstanding ${r.currency} ${r.outstanding.toLocaleString()} vs ${r.currency} ${r.monthlyBurn.toLocaleString()}/mo burn.`, severity: "high", action: { label: "Open finance", href: "/finance" } })
  }
  // Budgets forecast to exceed.
  for (const [cur, fcs] of Object.entries(input.budgetForecastByCurrency)) {
    for (const f of fcs) if (f.willExceed) s.push({ id: `budget-${cur}-${f.category}`, title: `${f.category} budget projected to overspend`, detail: `On current pace, ${cur} ${f.category} lands at ${cur} ${f.projected.toLocaleString()} vs a ${cur} ${f.budget.toLocaleString()} budget (over by ${cur} ${f.overBy.toLocaleString()}).`, severity: "medium", action: { label: "Review budgets", href: "/finance" } })
  }
  s.sort((a, b) => SEV[b.severity] - SEV[a.severity])
  const urgent = s.filter(x => x.severity === "urgent").length
  const summary = s.length === 0 ? "Finances look healthy — no pressing actions." : `${s.length} recommendation${s.length > 1 ? "s" : ""}${urgent ? `, ${urgent} urgent` : ""}.`
  return { summary, suggestions: s }
}

function round2(n: number) { return Math.round((Number(n) || 0) * 100) / 100 }
