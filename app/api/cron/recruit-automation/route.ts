import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notify"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/* EROS Batch 6 — Recruitment Automation. Reminder + SLA engine (daily):
 *  - interview reminders (scheduled within 24h) to participants,
 *  - offer-expiry nudges (SENT, unanswered, expiring within 2 days) to candidate + recruiter,
 *  - stale-pipeline SLA alerts (non-terminal application untouched > 14 days) to the job owner.
 * Bounded per run. Same cron auth as the other jobs. */
const DAY = 864e5
const TERMINAL = ["HIRED", "REJECTED", "WITHDRAWN", "DECLINED"]

async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET, workerSecret = process.env.WORKER_SECRET
  const okCron = cronSecret && (req.headers.get("authorization") || "") === `Bearer ${cronSecret}`
  const okWorker = workerSecret && (req.headers.get("x-worker-secret") || "") === workerSecret
  const host = req.headers.get("host") || ""
  const okLocal = !cronSecret && !workerSecret && (host.startsWith("localhost") || host.startsWith("127.0.0.1"))
  if (!okCron && !okWorker && !okLocal) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const now = Date.now()
  let interviewReminders = 0, offerNudges = 0, slaAlerts = 0

  // 1) Interview reminders — scheduled in the next 24h.
  const soon = await prisma.interview.findMany({
    where: { status: { in: ["SCHEDULED"] }, scheduledAt: { gte: new Date(now), lte: new Date(now + DAY) } },
    include: { participants: { select: { userId: true } } }, take: 500,
  }).catch(() => [] as any[])
  for (const iv of soon as any[]) {
    for (const p of iv.participants || []) {
      await createNotification({ userId: p.userId, title: `Interview reminder — ${iv.title}`, body: `Your interview is scheduled for ${new Date(iv.scheduledAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}. Room: ${iv.roomCode}.`, link: `/interviews/${iv.roomCode}`, sendEmail: false }).then(() => interviewReminders++).catch(() => {})
    }
  }

  // 2) Offer-expiry nudges — SENT, unanswered, expiring within 2 days.
  const expiring = await prisma.offer.findMany({
    where: { status: "SENT", respondedAt: null, expiresAt: { gte: new Date(now), lte: new Date(now + 2 * DAY) } },
    select: { id: true, title: true, companyName: true, candidateId: true, createdById: true, expiresAt: true }, take: 500,
  }).catch(() => [] as any[])
  for (const o of expiring as any[]) {
    await createNotification({ userId: o.candidateId, title: `Offer expiring soon — ${o.title}`, body: `Your offer from ${o.companyName} closes ${new Date(o.expiresAt).toLocaleDateString()}. Please respond.`, link: "/offers", sendEmail: false }).then(() => offerNudges++).catch(() => {})
    await createNotification({ userId: o.createdById, title: `Offer awaiting response — ${o.title}`, body: `The ${o.title} offer expires ${new Date(o.expiresAt).toLocaleDateString()} with no response yet.`, link: "/offers", sendEmail: false }).catch(() => {})
  }

  // 3) Stale-pipeline SLA — non-terminal applications untouched > 14 days.
  const stale = await prisma.application.findMany({
    where: { status: { notIn: TERMINAL }, updatedAt: { lt: new Date(now - 14 * DAY) } },
    select: { id: true, status: true, job: { select: { title: true, postedById: true } } },
    orderBy: { updatedAt: "asc" }, take: 500,
  }).catch(() => [] as any[])
  // Group by job owner so we send one digest, not one per application.
  const byOwner = new Map<string, { count: number; title?: string }>()
  for (const a of stale as any[]) {
    const owner = a.job?.postedById; if (!owner) continue
    const e = byOwner.get(owner) || { count: 0, title: a.job?.title }
    e.count++; byOwner.set(owner, e)
  }
  for (const [owner, e] of byOwner) {
    await createNotification({ userId: owner, title: `${e.count} application${e.count > 1 ? "s" : ""} need attention`, body: `${e.count} candidate${e.count > 1 ? "s have" : " has"} been waiting more than 14 days without a pipeline update. Review and move them forward.`, link: "/dashboard/recruiter", sendEmail: false }).then(() => slaAlerts++).catch(() => {})
  }

  return NextResponse.json({ ok: true, interviewReminders, offerNudges, slaAlerts })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
