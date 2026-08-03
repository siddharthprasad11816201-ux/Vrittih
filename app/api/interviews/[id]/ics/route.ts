import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { buildICS, interviewToEvent } from "@/lib/ical"
import { SITE } from "@/lib/site"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/* Download one interview as a .ics file — imports into any calendar. Only the
 * host, a participant, or an admin may fetch it. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const iv = await prisma.interview.findUnique({ where: { id: params.id }, include: { participants: { select: { userId: true } } } })
  if (!iv) return NextResponse.json({ error: "Interview not found" }, { status: 404 })
  const allowed = iv.hostId === p.userId || iv.participants.some((x) => x.userId === p.userId) || ["ADMIN", "SUPER_ADMIN"].includes(p.role)
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const ics = buildICS([interviewToEvent(iv, SITE)], { name: iv.title || "Vrittih interview" })
  return new NextResponse(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="interview-${iv.roomCode}.ics"` },
  })
}
