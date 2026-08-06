/* Enterprise ERP — finance rollups. PURE, testable.
 *
 * Phase 6. Deterministic financial summaries that are FX-SAFE: figures are grouped by
 * currency and NEVER summed across currencies (normalisation is a separate, explicit
 * step via lib/fx). Budget utilisation + document status vocabularies. No external services.
 */

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"] as const
export const EXPENSE_STATUSES = ["SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED"] as const
export const PO_STATUSES = ["DRAFT", "OPEN", "RECEIVED", "CLOSED", "CANCELLED"] as const

export interface MoneyDoc { amount: number; currency: string; status: string }

export interface CurrencyRollup {
  currency: string
  revenue: number       // PAID invoices
  outstanding: number   // SENT + OVERDUE invoices (owed to us)
  expenses: number      // APPROVED + REIMBURSED expenses
  net: number           // revenue − expenses
}

/* Per-currency financial rollup. Invoices = money in; expenses = money out. */
export function financialSummary(invoices: MoneyDoc[], expenses: MoneyDoc[]): CurrencyRollup[] {
  const map = new Map<string, CurrencyRollup>()
  const get = (c: string) => { const k = (c || "CHF").toUpperCase(); if (!map.has(k)) map.set(k, { currency: k, revenue: 0, outstanding: 0, expenses: 0, net: 0 }); return map.get(k)! }
  for (const inv of invoices) {
    const amt = Math.max(0, Number(inv.amount) || 0); const r = get(inv.currency)
    if (inv.status === "PAID") r.revenue += amt
    else if (inv.status === "SENT" || inv.status === "OVERDUE") r.outstanding += amt
  }
  for (const ex of expenses) {
    const amt = Math.max(0, Number(ex.amount) || 0); const r = get(ex.currency)
    if (ex.status === "APPROVED" || ex.status === "REIMBURSED") r.expenses += amt
  }
  const out = Array.from(map.values())
  for (const r of out) { r.net = +(r.revenue - r.expenses).toFixed(2); r.revenue = +r.revenue.toFixed(2); r.outstanding = +r.outstanding.toFixed(2); r.expenses = +r.expenses.toFixed(2) }
  return out.sort((a, b) => b.revenue - a.revenue)
}

export interface BudgetUtil { category: string; budget: number; spent: number; utilization: number; remaining: number; over: boolean }
/* Budget utilisation per category (same-currency inputs assumed; caller groups by currency). */
export function budgetUtilization(budgets: { category: string; amount: number }[], spentByCategory: Record<string, number>): BudgetUtil[] {
  return budgets.map(b => {
    const spent = Math.max(0, spentByCategory[b.category] || 0)
    const budget = Math.max(0, b.amount)
    const utilization = budget > 0 ? Math.round((spent / budget) * 100) : 0
    return { category: b.category, budget, spent, utilization, remaining: +(budget - spent).toFixed(2), over: spent > budget }
  }).sort((a, b) => b.utilization - a.utilization)
}
