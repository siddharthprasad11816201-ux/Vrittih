import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { completionPct, PPO_STATUSES, INTERNSHIP_STATUSES, MILESTONE_STATUSES } from "@/lib/internship"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function load(id: string) {
  return prisma.internship.findUnique({
    where: { id },
    include: {
      milestones: { orderBy: { week: "asc" } },
      user: { select: { id: true, name: true } }, mentor: { select: { id: true, name: true } },
      evaluations: { orderBy: { createdAt: "desc" } },
    },
  })
}
const canManage = (iv: any, ctx: any) => iv.createdById === ctx.userId || iv.mentorId === ctx.userId || ctx.has("admin.access")
const canView = (iv: any, ctx: any) => iv.userId === ctx.userId || canManage(iv, ctx)

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const iv = await load(params.id)
  if (!iv) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canView(iv, ctx)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json({ internship: { ...iv, completionPct: completionPct(iv.milestones), canManage: canManage(iv, ctx) } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const iv = await load(params.id)
  if (!iv) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canManage(iv, ctx)) return NextResponse.json({ error: "Only the employer, mentor or an admin can update this internship." }, { status: 403 })
  const b = await req.json().catch(() => ({}))

  if (b.action === "milestone" && b.milestoneId) {
    if (!(MILESTONE_STATUSES as readonly string[]).includes(b.status)) return NextResponse.json({ error: "Bad status" }, { status: 400 })
    await prisma.internshipMilestone.update({ where: { id: String(b.milestoneId) }, data: { status: b.status, completedAt: b.status === "DONE" ? new Date() : null } })
    const fresh = await prisma.internshipMilestone.findMany({ where: { internshipId: iv.id } })
    await prisma.internship.update({ where: { id: iv.id }, data: { completionPct: completionPct(fresh) } })
  } else if (b.action === "ppo" && (PPO_STATUSES as readonly string[]).includes(b.ppoStatus)) {
    await prisma.internship.update({ where: { id: iv.id }, data: { ppoStatus: b.ppoStatus } })
  } else if (b.action === "status" && (INTERNSHIP_STATUSES as readonly string[]).includes(b.status)) {
    await prisma.internship.update({ where: { id: iv.id }, data: { status: b.status } })
  } else if (b.action === "stipend") {
    await prisma.internship.update({ where: { id: iv.id }, data: { stipendAmount: b.stipendAmount != null ? Number(b.stipendAmount) : null, stipendCurrency: b.stipendCurrency || "INR" } })
  } else if (b.action === "mentor") {
    const m = b.mentorEmail ? await prisma.user.findUnique({ where: { email: String(b.mentorEmail).toLowerCase().trim() }, select: { id: true } }) : null
    await prisma.internship.update({ where: { id: iv.id }, data: { mentorId: m?.id || null } })
  } else if (b.action === "evaluate") {
    await prisma.evaluation.create({
      data: {
        internshipId: iv.id, subjectId: iv.userId, reviewerId: ctx.userId, reviewerName: ctx.user?.name || "Reviewer",
        kind: b.kind || "weekly", period: b.period || null,
        scoresJson: b.scores ? JSON.stringify(b.scores) : null, overall: b.overall != null ? Number(b.overall) : null,
        strengths: b.strengths || null, improvements: b.improvements || null, note: b.note || null,
      },
    })
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }
  const fresh = await load(iv.id)
  return NextResponse.json({ internship: { ...fresh, completionPct: completionPct(fresh!.milestones), canManage: true } })
}
