/* AIOS providers for Phase 5/6 operational intelligence — the AI Project Manager and
 * the Financial Intelligence advisor. Thin orchestration over the pure libs
 * (lib/project/*, lib/erp/intelligence): read the subject's REAL state from the DB, run
 * the deterministic engines, return structured, explainable output. Audited via the
 * gateway like every capability. No external LLM. */
import { prisma } from "@/lib/prisma"
import { registerProvider } from "./execute"
import { projectInsight } from "@/lib/project/intelligence"
import { resourceLoad, allocationBalance } from "@/lib/project/resource"
import { projectStandup } from "@/lib/project/manager"
import { arAging, burnRate, receivablesRunway, cashFlowProjection, budgetForecast, financeAdvisor } from "@/lib/erp/intelligence"

/* Fraction of a budget period that has elapsed (drives end-of-period projection).
 * "2026" → fraction of the year; "2026-08" → fraction of the month; else 0.5. */
function elapsedFractionForPeriod(period: string | null | undefined, now: number): number {
  if (!period) return 0.5
  const yearMonth = /^(\d{4})-(\d{2})$/.exec(period)
  const yearOnly = /^(\d{4})$/.exec(period)
  try {
    if (yearMonth) {
      const y = +yearMonth[1], m = +yearMonth[2] - 1
      const start = +new Date(y, m, 1), end = +new Date(y, m + 1, 1)
      return clampFrac((now - start) / (end - start))
    }
    if (yearOnly) {
      const y = +yearOnly[1]
      const start = +new Date(y, 0, 1), end = +new Date(y + 1, 0, 1)
      return clampFrac((now - start) / (end - start))
    }
  } catch { /* fall through */ }
  return 0.5
}
const clampFrac = (f: number) => Math.min(1, Math.max(0.01, Number.isFinite(f) ? f : 0.5))

/* Start/end (ms) of a budget period — must match elapsedFractionForPeriod's parsing so that
 * spend-to-date and elapsed-fraction refer to the SAME window. */
function periodWindow(period: string | null | undefined, now: number): { start: number; end: number } {
  const ym = /^(\d{4})-(\d{2})$/.exec(period || "")
  const yo = /^(\d{4})$/.exec(period || "")
  if (ym) { const y = +ym[1], m = +ym[2] - 1; return { start: +new Date(y, m, 1), end: +new Date(y, m + 1, 1) } }
  if (yo) { const y = +yo[1]; return { start: +new Date(y, 0, 1), end: +new Date(y + 1, 0, 1) } }
  const d = new Date(now); return { start: +new Date(d.getFullYear(), d.getMonth(), 1), end: +new Date(d.getFullYear(), d.getMonth() + 1, 1) }
}

/* AI Project Manager — portfolio standup from the owner's real projects/tasks/milestones. */
registerProvider("project.manager", async (ctx) => {
  const uid = ctx.subjectId as string
  const now = Date.now()
  const onlyId = ctx.input?.projectId ? String(ctx.input.projectId) : null

  const where: any = { ownerId: uid }
  if (onlyId) where.id = onlyId
  else where.status = { in: ["ACTIVE", "PLANNING"] }
  const projects = await prisma.project.findMany({ where, include: { milestones: { select: { id: true, title: true, status: true, dueAt: true } } }, take: 200 })
  const ids = projects.map(p => p.id)
  const tasks = ids.length ? await prisma.task.findMany({ where: { projectId: { in: ids } }, select: { id: true, projectId: true, status: true, priority: true, assigneeId: true, createdAt: true, updatedAt: true, completedAt: true, dueAt: true } }) : []
  const byProject = new Map<string, typeof tasks>()
  for (const t of tasks) { const arr = byProject.get(t.projectId!) || []; arr.push(t); byProject.set(t.projectId!, arr) }

  const insights = projects.map(p => projectInsight({ id: p.id, name: p.name, status: p.status, startAt: p.startAt, dueAt: p.dueAt }, byProject.get(p.id) || [], p.milestones, now))

  // Resource allocation across all open tasks; resolve Employee ids → names.
  const assigneeIds = Array.from(new Set(tasks.map(t => t.assigneeId).filter(Boolean))) as string[]
  const names: Record<string, string> = {}
  if (assigneeIds.length) {
    // Scope to the caller's own company so a foreign Employee.id can never be name-resolved (no cross-tenant leak).
    const emps = await prisma.employee.findMany({ where: { id: { in: assigneeIds }, employerId: uid }, select: { id: true, userId: true } }).catch(() => [] as any[])
    const users = emps.length ? await prisma.user.findMany({ where: { id: { in: emps.map(e => e.userId) } }, select: { id: true, name: true } }).catch(() => [] as any[]) : []
    const userName = new Map(users.map((u: any) => [u.id, u.name]))
    for (const e of emps) names[e.id] = userName.get(e.userId) || e.id.slice(0, 8)
  }
  const loads = resourceLoad(tasks.map(t => ({ assigneeId: t.assigneeId, status: t.status, priority: t.priority })), { names })
  const balance = allocationBalance(loads)
  const standup = projectStandup(insights, balance)

  return { output: { standup, insights, resource: { loads, balance } }, explanation: standup.summary, modelId: "project-manager-v1" }
})

/* Financial Intelligence advisor — AR aging, cash-flow projection, burn/runway, budget
 * forecast, and prioritised recommendations. All per-currency (FX-safe). */
registerProvider("finance.advisor", async (ctx) => {
  const uid = ctx.subjectId as string
  const now = Date.now()
  const where = { ownerId: uid }
  const [invoices, expenses, budgets] = await Promise.all([
    prisma.invoice.findMany({ where, select: { amount: true, currency: true, status: true, dueAt: true, createdAt: true }, take: 1000 }),
    prisma.expense.findMany({ where, select: { amount: true, currency: true, status: true, category: true, createdAt: true }, take: 1000 }),
    prisma.budget.findMany({ where, select: { category: true, amount: true, currency: true, period: true }, take: 300 }),
  ])

  const aging = arAging(invoices, now)
  const burn = burnRate(expenses, now)
  const runway = receivablesRunway(aging, burn)
  const cashflow = cashFlowProjection(invoices, expenses, { now })

  // Budget forecast grouped by currency (never merged across currencies). Each budget is
  // projected against ITS OWN period — spend-to-date is summed within that budget's window and
  // extrapolated by that same window's elapsed fraction (a per-currency single period would be
  // wrong when budgets carry different periods, e.g. an annual '2026' next to a monthly one).
  const approved = expenses.filter(e => e.status === "APPROVED" || e.status === "REIMBURSED")
  const currencies = Array.from(new Set(budgets.map(b => String(b.currency || "CHF").toUpperCase())))
  const budgetForecastByCurrency: Record<string, ReturnType<typeof budgetForecast>> = {}
  for (const cur of currencies) {
    const curBudgets = budgets.filter(b => String(b.currency || "CHF").toUpperCase() === cur)
    const rows: ReturnType<typeof budgetForecast> = []
    for (const bd of curBudgets) {
      const { start, end } = periodWindow(bd.period, now)
      const frac = elapsedFractionForPeriod(bd.period, now)
      let spent = 0
      for (const e of approved) {
        if (String(e.currency || "CHF").toUpperCase() !== cur) continue
        if (e.category !== bd.category) continue
        const t = +new Date(e.createdAt as any)
        if (!Number.isFinite(t) || t < start || t >= end) continue
        spent += e.amount
      }
      const [row] = budgetForecast([{ category: bd.category, amount: bd.amount }], { [bd.category]: spent }, frac)
      if (row) rows.push(row)
    }
    rows.sort((a, b) => (b.projected - b.budget) - (a.projected - a.budget))
    budgetForecastByCurrency[cur] = rows
  }

  const advice = financeAdvisor({ aging, cashflow, runway, budgetForecastByCurrency }, now)
  return { output: { advice, aging, burn, runway, cashflow, budgetForecastByCurrency }, explanation: advice.summary, modelId: "finance-advisor-v1" }
})
