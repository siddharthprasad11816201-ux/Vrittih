import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { POOL_KINDS, pipelineHealth } from "@/lib/talent/pools"

export const dynamic = "force-dynamic"
const canManage = (ctx: any) => ctx.has("candidates.view") || ctx.has("pipeline.manage") || ctx.has("jobs.post") || ctx.has("admin.access")

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const pools = await prisma.talentPool.findMany({
    where: ctx.has("admin.access") ? {} : { ownerId: ctx.userId },
    include: { members: { select: { stage: true, addedAt: true, lastActivityAt: true } } },
    orderBy: { updatedAt: "desc" }, take: 200,
  })
  return NextResponse.json({
    kinds: POOL_KINDS,
    pools: pools.map(p => ({
      id: p.id, name: p.name, kind: p.kind, description: p.description, createdAt: p.createdAt,
      size: p.members.length, health: pipelineHealth(p.members.map(m => ({ stage: m.stage, addedAt: m.addedAt, lastActivityAt: m.lastActivityAt }))),
    })),
  })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const b = await req.json()
  const name = String(b.name || "").trim()
  if (!name) return NextResponse.json({ error: "A pool name is required." }, { status: 400 })
  const kind = (POOL_KINDS as readonly any[]).some(k => k.key === b.kind) ? b.kind : "POOL"
  const pool = await prisma.talentPool.create({
    data: { ownerId: ctx.userId, name: name.slice(0, 160), kind, description: b.description ? String(b.description).slice(0, 2000) : null },
  })
  return NextResponse.json({ success: true, pool: { id: pool.id, name: pool.name, kind: pool.kind } }, { status: 201 })
}
