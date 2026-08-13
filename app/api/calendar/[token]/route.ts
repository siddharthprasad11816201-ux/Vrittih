import { NextRequest, NextResponse } from "next/server"
import { hashLookupToken } from "@/lib/crypto/storedSecret"
import { prisma } from "@/lib/prisma"
import { buildICS, interviewToEvent } from "@/lib/ical"
import { SITE } from "@/lib/site"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/* Subscribable interview calendar feed. The token IS the auth (calendar clients
 * send no cookies), so it's a long random secret; unknown token → 404. Returns
 * every interview the user hosts or attends in a ±window as a live .ics feed. */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  if (!token || token.length < 20) return new NextResponse("Not found", { status: 404 })
  // The token is a bearer credential used as a LOOKUP KEY, so it is stored HASHED —
  // encryption would break the query, since a random IV changes the ciphertext each time.
  // Tokens issued before hashing still resolve via the legacy branch, so existing calendar
  // subscriptions keep working until the user rotates.
  const user =
    (await prisma.user.findUnique({ where: { calendarToken: hashLookupToken(token) }, select: { id: true, name: true } })) ||
    (await prisma.user.findUnique({ where: { calendarToken: token }, select: { id: true, name: true } }))
  if (!user) return new NextResponse("Not found", { status: 404 })

  const from = new Date(Date.now() - 30 * 86400000)   // last 30 days
  const to = new Date(Date.now() + 365 * 86400000)     // next year
  const interviews = await prisma.interview.findMany({
    where: {
      scheduledAt: { gte: from, lte: to },
      OR: [{ hostId: user.id }, { participants: { some: { userId: user.id } } }],
    },
    orderBy: { scheduledAt: "asc" },
    take: 500,
  })

  const ics = buildICS(interviews.map((iv) => interviewToEvent(iv, SITE)), { name: `${user.name || "My"} · Vrittih interviews` })
  return new NextResponse(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" },
  })
}
