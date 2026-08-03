import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { pipelineHealth, MEMBER_STAGES } from "@/lib/talent/pools"

export const dynamic = "force-dynamic"
const canManage = (ctx: any) => ctx.has("candidates.view") || ctx.has("pipeline.manage") || ctx.has("jobs.post") || ctx.has("admin.access")

async function ownedPool(id: string, ctx: any) {
  const pool = await prisma.talentPool.findUnique({ where: { id } })
  if (!pool) return null
  if (pool.ownerId !== ctx.userId && !ctx.has("admin.access")) return "forbidden"
  return pool
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const pool = await ownedPool(params.id, ctx)
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 })
  if (pool === "forbidden") return NextResponse.json({ error: "Pool not found" }, { status: 404 })
  const members = await prisma.talentPoolMember.findMany({
    where: { poolId: pool.id },
    include: { member: { select: { id: true, name: true, email: true, headline: true } } },
    orderBy: { addedAt: "desc" },
  })
  return NextResponse.json({
    pool: { id: pool.id, name: pool.name, kind: pool.kind, description: pool.description },
    stages: MEMBER_STAGES,
    health: pipelineHealth(members.map(m => ({ stage: m.stage, addedAt: m.addedAt, lastActivityAt: m.lastActivityAt }))),
    members: members.map(m => ({
      id: m.id, stage: m.stage, note: m.note, source: m.source, addedAt: m.addedAt, lastActivityAt: m.lastActivityAt,
      name: m.member?.name || m.name,
      // Only ever surface the email the recruiter THEMSELVES supplied — never the
      // platform account email (which discover deliberately withholds). Prevents the
      // add-by-id → GET flow from becoming an email-harvest oracle.
      email: m.email || null,
      headline: m.member?.headline || null, userId: m.userId,
    })),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const pool = await ownedPool(params.id, ctx)
  if (!pool || pool === "forbidden") return NextResponse.json({ error: "Pool not found" }, { status: 404 })

  const b = await req.json()
  const action = String(b.action || "")

  if (action === "add") {
    // Add by email (resolve to a platform user if one exists, else store as external).
    const email = String(b.email || "").toLowerCase().trim()
    if (!email && !b.userId) return NextResponse.json({ error: "An email or user is required." }, { status: 400 })
    let userId: string | null = b.userId || null
    let name = b.name ? String(b.name).slice(0, 160) : null
    // Adding by a raw id must NOT become a way to read a withheld field (email). Only
    // job-seekers may be linked by id, and the pool GET never discloses their platform
    // email (see below) — so add-by-id can't be used as an email-harvest oracle.
    if (userId) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true } })
      if (!u || u.role !== "JOBSEEKER") return NextResponse.json({ error: "Only job-seekers can be added by id." }, { status: 400 })
      name = name || u.name
    } else if (email) {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } })
      if (u) { userId = u.id; name = name || u.name }
    }
    // Dedupe within the pool.
    if (userId) {
      const dupe = await prisma.talentPoolMember.findFirst({ where: { poolId: pool.id, userId } })
      if (dupe) return NextResponse.json({ error: "Already in this pool." }, { status: 409 })
    }
    const m = await prisma.talentPoolMember.create({
      data: { poolId: pool.id, userId, email: email || null, name, stage: "NEW", source: b.source ? String(b.source).slice(0, 60) : null, addedById: ctx.userId, lastActivityAt: new Date() },
    })
    return NextResponse.json({ success: true, memberId: m.id })
  }

  if (action === "stage") {
    const stage = String(b.stage || "").toUpperCase()
    if (!(MEMBER_STAGES as readonly string[]).includes(stage)) return NextResponse.json({ error: "Invalid stage." }, { status: 400 })
    const res = await prisma.talentPoolMember.updateMany({ where: { id: String(b.memberId), poolId: pool.id }, data: { stage, lastActivityAt: new Date() } })
    if (res.count !== 1) return NextResponse.json({ error: "Member not found." }, { status: 404 })
    return NextResponse.json({ success: true })
  }

  if (action === "note") {
    const res = await prisma.talentPoolMember.updateMany({ where: { id: String(b.memberId), poolId: pool.id }, data: { note: b.note ? String(b.note).slice(0, 2000) : null, lastActivityAt: new Date() } })
    if (res.count !== 1) return NextResponse.json({ error: "Member not found." }, { status: 404 })
    return NextResponse.json({ success: true })
  }

  if (action === "remove") {
    await prisma.talentPoolMember.deleteMany({ where: { id: String(b.memberId), poolId: pool.id } })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const pool = await ownedPool(params.id, ctx)
  if (!pool || pool === "forbidden") return NextResponse.json({ error: "Pool not found" }, { status: 404 })
  await prisma.talentPool.delete({ where: { id: pool.id } })
  return NextResponse.json({ success: true })
}
