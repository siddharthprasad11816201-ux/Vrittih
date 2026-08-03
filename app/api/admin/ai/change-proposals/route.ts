import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAction } from "@/lib/admin"

export const dynamic = "force-dynamic"

/* AIOS §27/§28 — human review of AI change proposals. The AI proposes changes to
 * sensitive surfaces (policy/compliance/hiring/legal/org/prompt/knowledge/
 * maintenance/governance); a human ADMIN approves or rejects. The AI never
 * self-approves. Applying an approved proposal is a separate, explicit step. */

export async function GET(req: NextRequest) {
  const ctx = requireAdmin(req)
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const status = new URL(req.url).searchParams.get("status") || undefined
  const rows = await prisma.changeProposal.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" }, take: 100,
  })
  return NextResponse.json({ proposals: rows.map((r) => ({ ...r, payload: safe(r.payload) })) })
}

export async function PATCH(req: NextRequest) {
  const ctx = requireAdmin(req)
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { id, decision } = body as { id?: string; decision?: "approved" | "rejected" }
  if (!id || !["approved", "rejected"].includes(decision || "")) return NextResponse.json({ error: "id and decision (approved|rejected) required" }, { status: 400 })

  const proposal = await prisma.changeProposal.findUnique({ where: { id } })
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (proposal.status !== "pending") return NextResponse.json({ error: `Already ${proposal.status}` }, { status: 409 })

  const updated = await prisma.changeProposal.update({ where: { id }, data: { status: decision, reviewedBy: ctx.userId, reviewedAt: new Date() } })
  await logAction(ctx.userId, `ai.change_proposal.${decision}`, { id, kind: proposal.kind, title: proposal.title }, req).catch(() => {})
  return NextResponse.json({ ok: true, proposal: { ...updated, payload: safe(updated.payload) } })
}

function safe(s: string) { try { return JSON.parse(s) } catch { return {} } }
