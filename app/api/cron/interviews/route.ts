import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notify"
import { dueReminders, reminderCopy, REMINDER_TIERS } from "@/lib/interview/reminders"
import { shouldAbandon, shouldMarkNoShow } from "@/lib/interview/state"
import { formatForViewer, normalizeTimeZone } from "@/lib/interview/timezone"

export const dynamic = "force-dynamic"

/**
 * Interview reminders + lifecycle sweep.
 *
 * Replaces the reminder block that lived in /api/cron/recruit-automation, which had no
 * dedupe column and no log: any retry (a Vercel cron retry, or a manual x-worker-secret
 * call) re-notified everyone, and there was only a single 24h tier.
 *
 * SCHEDULING NOTE, stated honestly: this is registered hourly. The 24h and 1h tiers are
 * therefore delivered reliably; the 15-minute tier can only fire if a run happens inside
 * that window, so it needs a sub-hourly scheduler to be dependable. The tier logic is
 * correct either way — the limitation is the cron cadence, not the code.
 */
async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const workerSecret = process.env.WORKER_SECRET
  const okCron = cronSecret && (req.headers.get("authorization") || "") === `Bearer ${cronSecret}`
  const okWorker = workerSecret && (req.headers.get("x-worker-secret") || "") === workerSecret
  const host = req.headers.get("host") || ""
  const okLocal = process.env.NODE_ENV !== "production" && !cronSecret && !workerSecret && (host.startsWith("localhost") || host.startsWith("127.0.0.1"))
  if (!okCron && !okWorker && !okLocal) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const now = new Date()
  const errors: string[] = []
  let remindersSent = 0, abandoned = 0, noShows = 0

  // ---- 1. Tiered, idempotent reminders ----
  try {
    const horizon = new Date(now.getTime() + 26 * 60 * 60 * 1000)
    const upcoming = await (prisma as any).interview.findMany({
      where: { status: { in: ["SCHEDULED", "RESCHEDULED"] }, scheduledAt: { gt: now, lte: horizon } },
      include: { participants: { include: { user: { select: { id: true, timezone: true } } } } },
      take: 500,
    })

    for (const iv of upcoming) {
      let sent: string[] = []
      try { sent = JSON.parse(iv.remindersSent || "[]") } catch { sent = [] }
      const due = dueReminders({ scheduledAt: iv.scheduledAt, now, alreadySent: sent })
      if (!due.length) continue

      for (const tier of due) {
        // Claim the tier BEFORE notifying, conditional on it not already being claimed.
        // Two concurrent workers cannot both pass this, so nobody is notified twice.
        const claimed = await (prisma as any).interview.updateMany({
          where: { id: iv.id, remindersSent: iv.remindersSent },
          data: { remindersSent: JSON.stringify([...sent, tier]) },
        })
        if (claimed.count === 0) break   // another worker got there first

        for (const p of iv.participants || []) {
          const localTime = formatForViewer(iv.scheduledAt, normalizeTimeZone(p.user?.timezone))
          const copy = reminderCopy({ title: iv.title, tier, localTime, roomCode: iv.roomCode })
          await createNotification({
            userId: p.userId,
            title: copy.title,
            body: copy.body,
            link: `/interviews/${iv.roomCode}`,
            type: "general",
            sendEmail: true,
          }).then(() => { remindersSent++ }).catch(() => {})
        }
      }
    }
  } catch (e: any) {
    errors.push(`reminders: ${e?.message || e}`)
  }

  // ---- 2. Lifecycle sweep ----
  // An interview left LIVE because the host's browser closed used to stay LIVE forever;
  // one nobody joined stayed SCHEDULED forever. Both are now reaped.
  try {
    const stale = await (prisma as any).interview.findMany({
      where: { status: { in: ["LIVE", "SCHEDULED", "RESCHEDULED"] }, scheduledAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } },
      select: { id: true, status: true, scheduledAt: true, duration: true },
      take: 500,
    })
    for (const iv of stale) {
      const target = shouldAbandon(iv.status, iv.scheduledAt, iv.duration, now)
        ? "ABANDONED"
        : shouldMarkNoShow(iv.status, iv.scheduledAt, iv.duration, now)
          ? "NO_SHOW"
          : null
      if (!target) continue
      const upd = await (prisma as any).interview.updateMany({
        where: { id: iv.id, status: iv.status },
        data: { status: target, endedAt: now },
      })
      if (upd.count) { target === "ABANDONED" ? abandoned++ : noShows++ }
    }
  } catch (e: any) {
    errors.push(`sweep: ${e?.message || e}`)
  }

  // Report failures instead of silently returning ok — a broken sweep otherwise only
  // surfaces weeks later as a pile of stuck interviews.
  return NextResponse.json(
    { ok: errors.length === 0, at: now.toISOString(), remindersSent, abandoned, noShows, tiers: REMINDER_TIERS.map((t) => t.key), errors },
    { status: errors.length ? 500 : 200 },
  )
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
