import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { analyzeCareer } from "@/lib/career/engine"
import { rankJobs } from "@/lib/career/match"
import { inputFromUser } from "@/lib/career/fromUser"
import { createNotification } from "@/lib/notify"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/* ICAE autonomous discovery — the "works in the background" sweep.
 * For recently-active job-seekers, finds NEW strong-fit roles they haven't applied to
 * or been told about, persists them as Recommendation rows, and notifies each candidate
 * about their top new matches. Idempotent via the Recommendation dedupe. Bounded per
 * run so it never overwhelms the connection pool.
 *
 * Auth: Vercel cron sends Authorization: Bearer $CRON_SECRET; a manual caller sends
 * x-worker-secret: $WORKER_SECRET. With neither set, only localhost is allowed. */

const STRONG = 75          // overall% that counts as a "strong" new match worth a nudge
const MAX_USERS = 40       // users processed per run
const MAX_NOTIFY = 3       // strong new matches announced per user per run
const NEW_JOB_DAYS = 4     // only consider recently-posted roles as "new"

async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const workerSecret = process.env.WORKER_SECRET
  const okCron = cronSecret && (req.headers.get("authorization") || "") === `Bearer ${cronSecret}`
  const okWorker = workerSecret && (req.headers.get("x-worker-secret") || "") === workerSecret
  const host = req.headers.get("host") || ""
  const okLocal = !cronSecret && !workerSecret && (host.startsWith("localhost") || host.startsWith("127.0.0.1"))
  if (!okCron && !okWorker && !okLocal) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const since = new Date(Date.now() - NEW_JOB_DAYS * 864e5)

  // Recent job-seekers who have a computed career profile (so matching is meaningful).
  const profiles = await prisma.careerProfile.findMany({
    orderBy: { computedAt: "desc" },
    take: MAX_USERS,
    select: { userId: true },
  })
  const userIds = profiles.map(p => p.userId)
  if (!userIds.length) return NextResponse.json({ ok: true, users: 0, recommended: 0, notified: 0 })

  // New active roles to consider (bounded).
  const jobs = await prisma.job.findMany({
    where: { active: true, createdAt: { gte: since } },
    select: { id: true, title: true, company: true, description: true, industry: true, remote: true, createdAt: true, skills: { include: { skill: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  let recommended = 0, notified = 0, processed = 0
  if (jobs.length) {
    const jobLikes = jobs.map(j => ({
      id: j.id, title: j.title, description: j.description, industry: j.industry, createdAt: j.createdAt, remote: j.remote,
      skills: (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
    }))

    for (const userId of userIds) {
      try {
        processed++
        const [applied, alreadyRec] = await Promise.all([
          prisma.application.findMany({ where: { userId }, select: { jobId: true } }),
          prisma.recommendation.findMany({ where: { subjectId: userId, domain: "job" }, select: { itemRef: true } }),
        ])
        const skip = new Set([...applied.map(a => a.jobId), ...alreadyRec.map(r => r.itemRef)])

        const skills = analyzeCareer(await inputFromUser(userId)).skills
        if (!skills.length) continue
        const ranked = rankJobs(skills, jobLikes)
          .filter(r => r.match.overall >= STRONG && !skip.has(r.job.id))
          .slice(0, MAX_NOTIFY)
        if (!ranked.length) continue

        // Persist recommendations (idempotent — these are all new by construction).
        for (const r of ranked) {
          const job = jobs.find(j => j.id === r.job.id)!
          await prisma.recommendation.create({
            data: {
              subjectId: userId, domain: "job", itemRef: r.job.id, score: r.match.overall / 100,
              modelId: "career.match", agentId: "icae.discover",
              context: JSON.stringify({
                title: job.title, company: job.company, overall: r.match.overall,
                matched: r.match.matched.slice(0, 4).map(m => m.skill),
                missing: r.match.missing.slice(0, 3).map(m => m.skill),
              }),
            },
          }).then(() => recommended++).catch(() => {})
        }

        // Announce the single strongest new match (link to the group view).
        const top = ranked[0]
        const topJob = jobs.find(j => j.id === top.job.id)!
        await createNotification({
          userId,
          title: `New strong match — ${topJob.title}`,
          body: ranked.length > 1
            ? `${topJob.company} and ${ranked.length - 1} more new role${ranked.length - 1 > 1 ? "s" : ""} fit your profile (${top.match.overall}%). Review and apply.`
            : `${topJob.company} posted a role that fits your profile (${top.match.overall}%). Review and apply.`,
          link: "/opportunities",
          sendEmail: false,
        }).then(() => notified++).catch(() => {})
      } catch { /* one user's failure never stops the sweep */ }
    }
  }

  return NextResponse.json({ ok: true, users: processed, jobsConsidered: jobs.length, recommended, notified })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
