import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"

export const dynamic = "force-dynamic"
export const maxDuration = 60
const canView = (ctx: any) => ctx.has("pipeline.manage") || ctx.has("jobs.post") || ctx.has("candidates.view") || ctx.has("ai.ops.view") || ctx.has("admin.access")

const INTERVIEW_SET = ["INTERVIEW", "INTERVIEWING", "ASSESSMENT"]
const OFFER_SET = ["OFFERED", "OFFER", "ACCEPTED"]
const NEG_SET = ["REJECTED", "WITHDRAWN", "DECLINED"]

/* EROS Batch 6 — Recruitment Analytics: the hiring funnel + offer/interview funnels +
 * key rates, scoped to the recruiter's jobs (admins see all). Derived from the
 * StatusEvent timeline ("ever reached"), never from a lossy current-status snapshot. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canView(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const isAdmin = ctx.has("admin.access")

  // Scope to the recruiter's own jobs (unless admin).
  let appIds: string[] | null = null
  if (!isAdmin) {
    const jobs = await prisma.job.findMany({ where: { postedById: ctx.userId }, select: { id: true }, take: 5000 })
    const apps = jobs.length ? await prisma.application.findMany({ where: { jobId: { in: jobs.map(j => j.id) } }, select: { id: true }, take: 20000 }) : []
    appIds = apps.map(a => a.id)
  }
  const seWhere = (statuses: string[]) => appIds ? { status: { in: statuses }, applicationId: { in: appIds } } : { status: { in: statuses } }
  const distinctApps = async (statuses: string[]) =>
    (await prisma.statusEvent.findMany({ where: seWhere(statuses), distinct: ["applicationId"], select: { applicationId: true }, take: 50000 }).catch(() => [] as any[])).length

  const [totalApps, reachedInterview, reachedOffer, hired, rejected, offersByStatus, interviewsByStatus] = await Promise.all([
    appIds ? Promise.resolve(appIds.length) : prisma.application.count(),
    distinctApps(INTERVIEW_SET),
    distinctApps(OFFER_SET),
    distinctApps(["HIRED"]),
    distinctApps(NEG_SET),
    prisma.offer.groupBy({ by: ["status"], where: isAdmin ? {} : { createdById: ctx.userId }, _count: { _all: true } }).catch(() => [] as any[]),
    prisma.interview.groupBy({ by: ["status"], where: isAdmin ? {} : { hostId: ctx.userId }, _count: { _all: true } }).catch(() => [] as any[]),
  ])

  const pct = (n: number, d: number) => d ? Math.round((n / d) * 1000) / 10 : null
  const funnel = [
    { stage: "Applied", count: totalApps },
    { stage: "Interviewed", count: reachedInterview },
    { stage: "Offered", count: reachedOffer },
    { stage: "Hired", count: hired },
  ]
  const groupMap = (g: any[]) => Object.fromEntries((g as any[]).map(x => [x.status, x._count?._all || 0]))
  const offers = groupMap(offersByStatus)
  const offersSent = (offers.SENT || 0) + (offers.ACCEPTED || 0) + (offers.DECLINED || 0)

  return NextResponse.json({
    scope: isAdmin ? "organization" : "your jobs",
    funnel,
    rates: {
      applicationToInterview: pct(reachedInterview, totalApps),
      interviewToOffer: pct(reachedOffer, reachedInterview),
      // Use ONE consistent source (the Offer table when offers were actually sent, else the
      // application funnel) and clamp — never mix operands or exceed 100%.
      offerAcceptance: (() => { const [num, den] = offersSent > 0 ? [offers.ACCEPTED || 0, offersSent] : [hired, reachedOffer]; return den > 0 ? Math.min(100, Math.round((num / den) * 100)) : 0 })(),
      hireRate: pct(hired, totalApps),
      rejectionRate: pct(rejected, totalApps),
    },
    offers: { byStatus: offers, total: (offersByStatus as any[]).reduce((a, x) => a + (x._count?._all || 0), 0) },
    interviews: { byStatus: groupMap(interviewsByStatus), total: (interviewsByStatus as any[]).reduce((a, x) => a + (x._count?._all || 0), 0) },
    generatedAt: new Date().toISOString(),
  })
}
