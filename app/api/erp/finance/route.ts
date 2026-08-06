import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { financialSummary, budgetUtilization, INVOICE_STATUSES, EXPENSE_STATUSES, PO_STATUSES } from "@/lib/erp/finance"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
const num = (v: any) => Math.max(0, Number(v) || 0)
const cur = (v: any) => String(v || "CHF").toUpperCase().slice(0, 3)

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const where = { ownerId: p.userId }
  const [invoices, expenses, vendors, pos, budgets] = await Promise.all([
    prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.expense.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.vendor.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.purchaseOrder.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.budget.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
  ])
  const summary = financialSummary(invoices, expenses)
  // Budget utilisation per CHF-category (approved+reimbursed expenses, CHF only — caller groups by currency).
  const spentByCat: Record<string, number> = {}
  for (const e of expenses) if ((e.status === "APPROVED" || e.status === "REIMBURSED") && e.currency === "CHF") spentByCat[e.category] = (spentByCat[e.category] || 0) + e.amount
  const budgetUtil = budgetUtilization(budgets.filter(b => b.currency === "CHF").map(b => ({ category: b.category, amount: b.amount })), spentByCat)
  return NextResponse.json({ summary, invoices, expenses, vendors, pos, budgets, budgetUtil, statuses: { invoice: INVOICE_STATUSES, expense: EXPENSE_STATUSES, po: PO_STATUSES } })
}

export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const action = String(b.action || "")

  if (action === "create-invoice") {
    const number = String(b.number || "").trim() || `INV-${Date.now().toString(36).toUpperCase()}`
    await prisma.invoice.create({ data: { ownerId: p.userId, number: number.slice(0, 60), client: b.client ? String(b.client).slice(0, 200) : null, amount: num(b.amount), currency: cur(b.currency), status: "DRAFT", dueAt: b.dueAt ? new Date(b.dueAt) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "create-expense") {
    await prisma.expense.create({ data: { ownerId: p.userId, category: String(b.category || "general").slice(0, 60), description: b.description ? String(b.description).slice(0, 500) : null, amount: num(b.amount), currency: cur(b.currency), status: "SUBMITTED" } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "create-vendor") {
    const name = String(b.name || "").trim(); if (!name) return NextResponse.json({ error: "Vendor name required." }, { status: 400 })
    await prisma.vendor.create({ data: { ownerId: p.userId, name: name.slice(0, 200), contact: b.contact ? String(b.contact).slice(0, 200) : null, category: b.category ? String(b.category).slice(0, 60) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "create-po") {
    const title = String(b.title || "").trim(); if (!title) return NextResponse.json({ error: "PO title required." }, { status: 400 })
    await prisma.purchaseOrder.create({ data: { ownerId: p.userId, vendorId: b.vendorId ? String(b.vendorId) : null, title: title.slice(0, 200), amount: num(b.amount), currency: cur(b.currency), status: "DRAFT" } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "create-budget") {
    const category = String(b.category || "").trim(); if (!category) return NextResponse.json({ error: "Budget category required." }, { status: 400 })
    await prisma.budget.create({ data: { ownerId: p.userId, category: category.slice(0, 60), amount: num(b.amount), currency: cur(b.currency), period: b.period ? String(b.period).slice(0, 40) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "set-status") {
    const kind = String(b.kind || ""); const id = String(b.id || ""); const status = String(b.status || "").toUpperCase()
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 })
    if (kind === "invoice") {
      if (!(INVOICE_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
      const row = await prisma.invoice.findUnique({ where: { id }, select: { ownerId: true } }); if (row?.ownerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })
      await prisma.invoice.update({ where: { id }, data: { status } }); return NextResponse.json({ success: true })
    }
    if (kind === "expense") {
      if (!(EXPENSE_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
      const row = await prisma.expense.findUnique({ where: { id }, select: { ownerId: true } }); if (row?.ownerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })
      await prisma.expense.update({ where: { id }, data: { status } }); return NextResponse.json({ success: true })
    }
    if (kind === "po") {
      if (!(PO_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
      const row = await prisma.purchaseOrder.findUnique({ where: { id }, select: { ownerId: true } }); if (row?.ownerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })
      await prisma.purchaseOrder.update({ where: { id }, data: { status } }); return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: "Unknown kind." }, { status: 400 })
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
