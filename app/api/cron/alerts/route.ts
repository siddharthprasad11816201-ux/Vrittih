import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { computeMatch, candidateFromUser, jobFromRecord } from "@/lib/matching"
import { isDue, newMatches, normalizeQuery, alertNotification, type AlertFreq } from "@/lib/alerts"
import { createNotification } from "@/lib/notify"

export const dynamic = "force-dynamic"

/* Job alerts — re-runs each due SavedSearch, scores genuinely NEW jobs with the same
 * in-house matcher the /jobs page uses, and writes a Notification when there are hits.
 * Auth mirrors /api/cron/calibrate: Vercel cron Bearer $CRON_SECRET, a manual
 * x-worker-secret, or localhost when neither secret is set. */
async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const workerSecret = process.env.WORKER_SECRET
  const okCron = cronSecret && (req.headers.get("authorization") || "") === `Bearer ${cronSecret}`
  const okWorker = workerSecret && (req.headers.get("x-worker-secret") || "") === workerSecret
  const host = req.headers.get("host") || ""
  const okLocal = !cronSecret && !workerSecret && (host.startsWith("localhost") || host.startsWith("127.0.0.1"))
  if (!okCron && !okWorker && !okLocal) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const now = new Date()
  const searches = await (prisma as any).savedSearch.findMany({ where: { alertFreq: { not: "off" } } })

  let considered = 0, fired = 0, notified = 0
  const userCache = new Map<string, any>()

  for (const s of searches) {
    if (!isDue(s.alertFreq as AlertFreq, s.lastRunAt, now)) continue
    considered++

    let query: any = {}
    try { query = normalizeQuery(JSON.parse(s.query)) } catch { query = {} }

    // Build the same WHERE the /jobs search uses, restricted to jobs newer than the cursor.
    const where: any = { active: true }
    if (s.lastNotified) where.createdAt = { gt: s.lastNotified }
    if (query.industry) where.industry = query.industry
    if (query.type) where.type = query.type
    if (query.remote) where.remote = true
    if (query.q) {
      where.OR = [
        { title: { contains: query.q } },
        { description: { contains: query.q } },
        { company: { contains: query.q } },
      ]
    }

    const jobs = await prisma.job.findMany({
      where,
      include: { skills: { include: { skill: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    // Score against the owner's profile only when the search asks for a minimum match.
    let scored = jobs.map((j: any) => ({ id: j.id, createdAt: j.createdAt, title: j.title, score: undefined as number | undefined }))
    if (query.minMatch && jobs.length) {
      let user = userCache.get(s.userId)
      if (user === undefined) {
        user = await prisma.user.findUnique({
          where: { id: s.userId },
          include: { skills: { include: { skill: true } }, experience: true, education: true },
        })
        if (user) (user as any).skillAssessments = await (prisma as any).skillAssessment.findMany({ where: { userId: s.userId } })
        userCache.set(s.userId, user)
      }
      if (user) {
        const cand = candidateFromUser(user)
        scored = jobs.map((j: any) => ({ id: j.id, createdAt: j.createdAt, title: j.title, score: computeMatch(jobFromRecord(j), cand).score }))
      }
    }

    const { matches, cursor } = newMatches(scored, s.lastNotified, query.minMatch || 0)

    if (matches.length) {
      const copy = alertNotification(s.name, matches)
      await createNotification({
        userId: s.userId,
        title: copy.title,
        body: copy.body,
        link: `/jobs?savedSearch=${s.id}`,
        type: "job_alert",
        sendEmail: true,
      }).catch(() => {})
      fired++
      notified += matches.length
    }

    await (prisma as any).savedSearch.update({
      where: { id: s.id },
      data: { lastRunAt: now, lastNotified: cursor ?? s.lastNotified },
    })
  }

  return NextResponse.json({ ok: true, at: now.toISOString(), searches: searches.length, considered, fired, jobsNotified: notified })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
