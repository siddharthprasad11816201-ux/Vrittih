import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/* POST /api/marketplace/[slug]/run — run an installed AGENT item's capability through
 * the AIOS gateway. The gateway enforces the CALLER's own authorization + audits the
 * run, so installing an item can never grant a capability the caller doesn't hold. */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const item = await prisma.marketplaceItem.findUnique({ where: { slug: params.slug }, select: { id: true, kind: true, spec: true } })
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })
  if (item.kind !== "AGENT") return NextResponse.json({ error: "This item is not a runnable agent." }, { status: 400 })

  let capId: string | null = null
  try { capId = JSON.parse(item.spec || "{}").capId || null } catch {}
  if (!capId) return NextResponse.json({ error: "This agent has no runnable capability." }, { status: 400 })

  // Must be installed to run — mirrors the review gate and keeps installs meaningful.
  const installed = await prisma.marketplaceInstall.findUnique({ where: { itemId_userId: { itemId: item.id, userId: ctx.userId } }, select: { id: true } })
  if (!installed) return NextResponse.json({ error: "Install this agent before running it." }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const r = await execute(capId, { subjectId: ctx.userId, input: body.input ?? {}, caps: Array.from(ctx.capabilities) })
  if (!r.ok) {
    // Surface the gateway's honest failure (denied / missing capability / no evidence)
    const status = r.status === "denied" ? 403 : r.status === "blocked" ? 403 : 500
    return NextResponse.json({ error: r.error || "This agent could not run.", status: r.status }, { status })
  }
  return NextResponse.json({ ok: true, output: r.output, explanation: r.explanation, runId: r.runId })
}
