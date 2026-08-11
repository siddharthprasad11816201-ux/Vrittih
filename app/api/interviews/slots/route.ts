import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { generateSlots, isSlotBookable, type AvailabilityRule, type BusyInterval } from "@/lib/interview/slots"
import { normalizeTimeZone, formatForViewer } from "@/lib/interview/timezone"
import { rateLimit } from "@/lib/ratelimit/store"
import crypto from "crypto"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

const MAX_RANGE_DAYS = 60

/** Everything already occupying an interviewer's calendar: interviews + explicit blocks. */
async function busyFor(userId: string, from: Date, to: Date): Promise<BusyInterval[]> {
  const [interviews, exceptions] = await Promise.all([
    (prisma as any).interview.findMany({
      // Cancelled/no-show interviews free their slot again; live ones still block it.
      where: {
        status: { in: ["SCHEDULED", "RESCHEDULED", "LIVE"] },
        scheduledAt: { gte: new Date(from.getTime() - 24 * 3600_000), lte: to },
        OR: [{ hostId: userId }, { participants: { some: { userId } } }],
      },
      select: { scheduledAt: true, duration: true },
      take: 500,
    }),
    (prisma as any).availabilityException.findMany({
      where: { userId, end: { gte: from }, start: { lte: to } },
      select: { start: true, end: true },
      take: 500,
    }),
  ])
  return [
    ...interviews.map((i: any) => ({ start: i.scheduledAt, end: new Date(i.scheduledAt.getTime() + (i.duration || 60) * 60000) })),
    ...exceptions.map((e: any) => ({ start: e.start, end: e.end })),
  ]
}

// Bookable slots for an interviewer. This is what candidate self-scheduling reads —
// nothing like it existed before, so a recruiter had to type a datetime by hand.
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const url = new URL(req.url)
  const hostId = url.searchParams.get("hostId") || ""
  if (!hostId) return NextResponse.json({ error: "hostId is required" }, { status: 400 })

  const now = new Date()
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : now
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date(now.getTime() + 14 * 86400000)
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 })
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86400000) {
    return NextResponse.json({ error: `Range cannot exceed ${MAX_RANGE_DAYS} days.` }, { status: 400 })
  }
  const duration = Math.max(5, Math.min(480, Number(url.searchParams.get("duration") || 60)))

  const [host, rules] = await Promise.all([
    prisma.user.findUnique({ where: { id: hostId }, select: { id: true, name: true, timezone: true } }),
    (prisma as any).availabilityRule.findMany({ where: { userId: hostId, active: true } }),
  ])
  if (!host) return NextResponse.json({ error: "Interviewer not found" }, { status: 404 })
  const zone = normalizeTimeZone(rules[0]?.timezone || host.timezone)

  const slots = generateSlots({
    from, to, now, timezone: zone,
    rules: rules.map((r: any): AvailabilityRule => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute })),
    busy: await busyFor(hostId, from, to),
    config: { durationMinutes: duration },
  })

  // The viewer's own zone, so the UI can label times without guessing.
  const viewer = await prisma.user.findUnique({ where: { id: payload.userId }, select: { timezone: true } })
  const viewerZone = normalizeTimeZone(viewer?.timezone)

  return NextResponse.json({
    hostId, hostName: host.name, hostTimezone: zone, viewerTimezone: viewerZone, duration,
    slots: slots.slice(0, 500).map((s) => ({
      start: s.start, end: s.end,
      localLabel: formatForViewer(s.start, viewerZone),
    })),
  })
}

// Book a slot. Availability and conflicts are re-checked SERVER-side: a client could
// otherwise post any time, and two candidates could race for the same slot.
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const rl = await rateLimit("write", payload.userId, { scope: "book" })
  if (!rl.allowed) return NextResponse.json({ error: "Too many booking attempts. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

  try {
    const body = await req.json()
    const hostId = String(body?.hostId || "")
    const start = new Date(body?.start)
    const duration = Math.max(5, Math.min(480, Number(body?.duration || 60)))
    const title = String(body?.title || "Interview").slice(0, 160)
    const applicationId = body?.applicationId ? String(body.applicationId) : null
    if (!hostId || isNaN(start.getTime())) return NextResponse.json({ error: "hostId and a valid start are required." }, { status: 400 })

    const [host, rules] = await Promise.all([
      prisma.user.findUnique({ where: { id: hostId }, select: { id: true, timezone: true } }),
      (prisma as any).availabilityRule.findMany({ where: { userId: hostId, active: true } }),
    ])
    if (!host) return NextResponse.json({ error: "Interviewer not found" }, { status: 404 })
    const zone = normalizeTimeZone(rules[0]?.timezone || host.timezone)

    const now = new Date()
    const check = isSlotBookable({
      start, now, timezone: zone,
      rules: rules.map((r: any): AvailabilityRule => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute })),
      busy: await busyFor(hostId, new Date(start.getTime() - 86400000), new Date(start.getTime() + 86400000)),
      config: { durationMinutes: duration },
    })
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 })

    const roomCode = crypto.randomBytes(16).toString("hex").toUpperCase()
    const interview = await (prisma as any).interview.create({
      data: {
        title, type: "ONE_ON_ONE", status: "SCHEDULED",
        scheduledAt: start, timezone: zone, duration,
        hostId, applicationId, roomCode,
        participants: { create: [{ userId: hostId, role: "HOST" }, { userId: payload.userId, role: "CANDIDATE" }] },
      },
      select: { id: true, roomCode: true, scheduledAt: true, duration: true },
    })

    // Re-check for a booking that landed in the same instant. The generator is advisory;
    // this is the authority. If we lost the race, roll our own booking back rather than
    // leaving a double-booked interviewer.
    const clash = await (prisma as any).interview.count({
      where: {
        id: { not: interview.id },
        status: { in: ["SCHEDULED", "RESCHEDULED", "LIVE"] },
        hostId,
        scheduledAt: { lt: new Date(start.getTime() + duration * 60000), gte: new Date(start.getTime() - 480 * 60000) },
      },
    })
    if (clash > 0) {
      const overlapping = await (prisma as any).interview.findMany({
        where: { id: { not: interview.id }, status: { in: ["SCHEDULED", "RESCHEDULED", "LIVE"] }, hostId },
        select: { scheduledAt: true, duration: true }, take: 200,
      })
      const end = new Date(start.getTime() + duration * 60000)
      const real = overlapping.some((o: any) => o.scheduledAt < end && new Date(o.scheduledAt.getTime() + (o.duration || 60) * 60000) > start)
      if (real) {
        await (prisma as any).interview.delete({ where: { id: interview.id } }).catch(() => {})
        return NextResponse.json({ error: "That time was just taken. Please choose another slot." }, { status: 409 })
      }
    }

    return NextResponse.json({ ok: true, interview }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
