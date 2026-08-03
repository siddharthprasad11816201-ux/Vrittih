import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { sessionRisk } from "@/lib/proctor/events"

export const dynamic = "force-dynamic"

const canReview = (ctx: any) => ctx.has("interviews.host") || ctx.has("pipeline.manage") || ctx.has("candidates.view") || ctx.has("admin.access")

/* Is this reviewer responsible for this session? (host of the interview, or owner of
 * the job behind the assessment attempt, or admin.) */
async function authorizedFor(ctx: any, session: any): Promise<boolean> {
  if (ctx.has("admin.access")) return true
  if (session.kind === "interview") {
    const iv = await prisma.interview.findUnique({ where: { id: session.refId }, select: { hostId: true } })
    return !!iv && iv.hostId === ctx.userId
  }
  const attempt = await prisma.testAttempt.findUnique({ where: { id: session.refId }, select: { testId: true } }).catch(() => null)
  if (!attempt) return false
  const test = await prisma.test.findUnique({ where: { id: attempt.testId }, select: { jobId: true } }).catch(() => null)
  if (!test?.jobId) return false
  const job = await prisma.job.findUnique({ where: { id: test.jobId }, select: { postedById: true } })
  return !!job && job.postedById === ctx.userId
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canReview(ctx)) return NextResponse.json({ error: "You need reviewer access." }, { status: 403 })
  const session = await prisma.proctorSession.findUnique({
    where: { id: params.id },
    include: { subject: { select: { id: true, name: true, email: true } }, events: { orderBy: { ts: "asc" }, take: 1000 } },
  })
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
  if (!(await authorizedFor(ctx, session))) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  const risk = sessionRisk(session.events.map(e => ({ type: e.type, confidence: e.confidence })))
  return NextResponse.json({
    session: {
      id: session.id, kind: session.kind, refId: session.refId, consent: session.consent, status: session.status,
      riskScore: session.riskScore, reviewStatus: session.reviewStatus, reviewNote: session.reviewNote,
      reviewedAt: session.reviewedAt, startedAt: session.startedAt,
      subject: session.subject ? { id: session.subject.id, name: session.subject.name, email: session.subject.email } : null,
    },
    risk,
    events: session.events.map(e => ({
      id: e.id, type: e.type, source: e.source, ts: e.ts, confidence: e.confidence, severity: e.severity,
      policyRef: e.policyRef, evidence: e.evidence ? safe(e.evidence) : null, reviewStatus: e.reviewStatus,
    })),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canReview(ctx)) return NextResponse.json({ error: "You need reviewer access." }, { status: 403 })
  const session = await prisma.proctorSession.findUnique({ where: { id: params.id }, select: { id: true, kind: true, refId: true } })
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
  if (!(await authorizedFor(ctx, session))) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  const b = await req.json()
  const reviewStatus = String(b.reviewStatus || "").toUpperCase()
  if (!["CLEARED", "FLAGGED", "PENDING"].includes(reviewStatus)) {
    return NextResponse.json({ error: "reviewStatus must be CLEARED, FLAGGED or PENDING." }, { status: 400 })
  }
  // The human decision is authoritative and audited.
  await prisma.proctorSession.update({
    where: { id: session.id },
    data: { reviewStatus, reviewedById: ctx.userId, reviewedAt: new Date(), reviewNote: b.note ? String(b.note).slice(0, 2000) : undefined },
  })
  return NextResponse.json({ success: true, reviewStatus })
}

function safe(s: string) { try { return JSON.parse(s) } catch { return null } }
