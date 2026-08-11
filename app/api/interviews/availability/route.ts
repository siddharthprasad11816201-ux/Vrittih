import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { isValidTimeZone, normalizeTimeZone } from "@/lib/interview/timezone"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

// An interviewer's weekly bookable hours, plus one-off exceptions (PTO, holidays).
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const userId = new URL(req.url).searchParams.get("userId") || payload.userId

  const [rules, exceptions, me] = await Promise.all([
    (prisma as any).availabilityRule.findMany({ where: { userId, active: true }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] }),
    (prisma as any).availabilityException.findMany({ where: { userId, end: { gte: new Date() } }, orderBy: { start: "asc" }, take: 200 }),
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
  ])
  return NextResponse.json({
    userId,
    timezone: normalizeTimeZone(me?.timezone),
    rules: rules.map((r: any) => ({ id: r.id, weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute, timezone: r.timezone })),
    exceptions: exceptions.map((e: any) => ({ id: e.id, start: e.start, end: e.end, reason: e.reason })),
  })
}

// Replace the caller's weekly availability. Rules are validated so an impossible window
// (end before start, minutes outside a day) can never reach slot generation.
export async function PUT(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const body = await req.json()
    const tz = String(body?.timezone || "")
    if (tz && !isValidTimeZone(tz)) return NextResponse.json({ error: `Unknown timezone "${tz}".` }, { status: 400 })
    const zone = normalizeTimeZone(tz)

    const raw = Array.isArray(body?.rules) ? body.rules : []
    if (raw.length > 100) return NextResponse.json({ error: "Too many availability rules." }, { status: 400 })

    const rules: { weekday: number; startMinute: number; endMinute: number }[] = []
    for (const r of raw) {
      const weekday = Number(r?.weekday)
      const startMinute = Number(r?.startMinute)
      const endMinute = Number(r?.endMinute)
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        return NextResponse.json({ error: "weekday must be an integer 0 (Sunday) to 6 (Saturday)." }, { status: 400 })
      }
      if (![startMinute, endMinute].every((n) => Number.isInteger(n) && n >= 0 && n <= 1440)) {
        return NextResponse.json({ error: "startMinute and endMinute must be 0–1440." }, { status: 400 })
      }
      if (endMinute <= startMinute) {
        return NextResponse.json({ error: "endMinute must be after startMinute." }, { status: 400 })
      }
      rules.push({ weekday, startMinute, endMinute })
    }

    // Replace atomically so a partial write cannot leave half a schedule live.
    await prisma.$transaction([
      (prisma as any).availabilityRule.deleteMany({ where: { userId: payload.userId } }),
      ...(rules.length
        ? [(prisma as any).availabilityRule.createMany({
            data: rules.map((r) => ({ ...r, userId: payload.userId, timezone: zone })),
          })]
        : []),
      prisma.user.update({ where: { id: payload.userId }, data: { timezone: zone } }),
    ])
    return NextResponse.json({ ok: true, count: rules.length, timezone: zone })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

// Add a one-off unavailable block.
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const body = await req.json()
    const start = new Date(body?.start)
    const end = new Date(body?.end)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return NextResponse.json({ error: "Valid start and end are required." }, { status: 400 })
    if (end <= start) return NextResponse.json({ error: "end must be after start." }, { status: 400 })
    const row = await (prisma as any).availabilityException.create({
      data: { userId: payload.userId, start, end, reason: typeof body?.reason === "string" ? body.reason.slice(0, 200) : null },
    })
    return NextResponse.json({ ok: true, id: row.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const id = new URL(req.url).searchParams.get("id") || ""
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  // Ownership is part of the WHERE, so one user can never delete another's availability.
  const r = await (prisma as any).availabilityException.deleteMany({ where: { id, userId: payload.userId } })
  if (!r.count) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
