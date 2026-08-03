import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"

export const dynamic = "force-dynamic"

/* EROS Module 6/7 — proctoring reviewer list. Human reviewers see the sessions they're
 * responsible for (interviews they host / attempts for their jobs), ranked by risk.
 * Capability-gated; admins see all. */

const canReview = (ctx: any) => ctx.has("interviews.host") || ctx.has("pipeline.manage") || ctx.has("candidates.view") || ctx.has("admin.access")

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canReview(ctx)) return NextResponse.json({ error: "You need reviewer access." }, { status: 403 })

  let where: any = {}
  if (!ctx.has("admin.access")) {
    const [myInterviews, myJobs] = await Promise.all([
      prisma.interview.findMany({ where: { hostId: ctx.userId }, select: { id: true }, take: 2000 }),
      prisma.job.findMany({ where: { postedById: ctx.userId }, select: { id: true }, take: 2000 }),
    ])
    const interviewIds = myInterviews.map(i => i.id)
    let attemptIds: string[] = []
    if (myJobs.length) {
      const tests = await prisma.test.findMany({ where: { jobId: { in: myJobs.map(j => j.id) } }, select: { id: true }, take: 2000 }).catch(() => [] as any[])
      if (tests.length) {
        const attempts = await prisma.testAttempt.findMany({ where: { testId: { in: tests.map((t: any) => t.id) } }, select: { id: true }, take: 5000 }).catch(() => [] as any[])
        attemptIds = attempts.map((a: any) => a.id)
      }
    }
    if (!interviewIds.length && !attemptIds.length) return NextResponse.json({ sessions: [] })
    where = { OR: [
      { kind: "interview", refId: { in: interviewIds } },
      { kind: "assessment", refId: { in: attemptIds } },
    ] }
  }

  const status = new URL(req.url).searchParams.get("status")
  if (status && ["PENDING", "CLEARED", "FLAGGED"].includes(status)) where.reviewStatus = status

  const sessions = await prisma.proctorSession.findMany({
    where,
    include: { subject: { select: { id: true, name: true, email: true } }, _count: { select: { events: true } } },
    orderBy: [{ riskScore: "desc" }, { startedAt: "desc" }],
    take: 200,
  })
  return NextResponse.json({
    sessions: sessions.map(s => ({
      id: s.id, kind: s.kind, refId: s.refId, riskScore: s.riskScore, reviewStatus: s.reviewStatus,
      consent: s.consent, status: s.status, eventCount: s._count.events, startedAt: s.startedAt,
      reviewedAt: s.reviewedAt, subject: s.subject ? { id: s.subject.id, name: s.subject.name, email: s.subject.email } : null,
    })),
  })
}
