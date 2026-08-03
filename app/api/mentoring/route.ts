import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { createNotification } from "@/lib/notify"
import { MENTOR_MIN_PROFICIENCY, canMentorshipTransition } from "@/lib/learning/mentoring"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

/* ELTOS Module 8 — Mentoring. GET: discover mentors for a competency + my mentorships +
 * my availability. POST: request. PATCH: accept/decline/complete/withdraw or toggle
 * availability. Mentors surface by demonstrated proficiency + opt-in. */
export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const competency = new URL(req.url).searchParams.get("competency")

  const [me, asMentor, asMentee, myWeak] = await Promise.all([
    prisma.user.findUnique({ where: { id: p.userId }, select: { openToMentor: true } }),
    prisma.mentorship.findMany({ where: { mentorId: p.userId }, include: { mentee: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.mentorship.findMany({ where: { menteeId: p.userId }, include: { mentor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.userCompetency.findMany({ where: { userId: p.userId }, orderBy: { proficiency: "asc" }, take: 6, select: { competencyKey: true, proficiency: true } }),
  ])

  // Discover: users who demonstrably hold this competency at Advanced+ AND opted in.
  let mentors: any[] = []
  if (competency) {
    const strong = await prisma.userCompetency.findMany({
      where: { competencyKey: competency, proficiency: { gte: MENTOR_MIN_PROFICIENCY }, userId: { not: p.userId }, user: { openToMentor: true } },
      include: { user: { select: { id: true, name: true, headline: true } } },
      orderBy: { proficiency: "desc" }, take: 20,
    }).catch(() => [] as any[])
    mentors = strong.map((s: any) => ({ userId: s.userId, name: s.user?.name, headline: s.user?.headline, proficiency: s.proficiency }))
  }

  const shape = (m: any, who: "mentor" | "mentee") => ({ id: m.id, status: m.status, competencyKey: m.competencyKey, message: m.message, createdAt: m.createdAt, counterpart: who === "mentor" ? m.mentee?.name : m.mentor?.name })
  return NextResponse.json({
    openToMentor: !!me?.openToMentor,
    myGaps: myWeak.map(w => ({ key: w.competencyKey, proficiency: w.proficiency })),
    mentors,
    incoming: asMentor.map(m => shape(m, "mentor")),
    outgoing: asMentee.map(m => shape(m, "mentee")),
  })
}

export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const mentorId = String(b.mentorId || "")
  if (!mentorId || mentorId === p.userId) return NextResponse.json({ error: "Choose a mentor other than yourself." }, { status: 400 })
  const mentor = await prisma.user.findUnique({ where: { id: mentorId }, select: { openToMentor: true } })
  if (!mentor?.openToMentor) return NextResponse.json({ error: "That person isn't available to mentor." }, { status: 409 })
  // One active/pending request per pair.
  const dupe = await prisma.mentorship.findFirst({ where: { mentorId, menteeId: p.userId, status: { in: ["REQUESTED", "ACTIVE"] } } })
  if (dupe) return NextResponse.json({ error: "You already have a pending or active mentorship with them." }, { status: 409 })
  const m = await prisma.mentorship.create({
    data: { mentorId, menteeId: p.userId, competencyKey: b.competencyKey ? String(b.competencyKey).slice(0, 60) : null, message: b.message ? String(b.message).slice(0, 1000) : null, status: "REQUESTED" },
  })
  await createNotification({ userId: mentorId, title: "New mentorship request", body: `Someone asked you to mentor them${b.competencyKey ? ` in ${b.competencyKey}` : ""}.`, link: "/mentoring", sendEmail: false }).catch(() => {})
  return NextResponse.json({ success: true, id: m.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()

  if (b.action === "availability") {
    await prisma.user.update({ where: { id: p.userId }, data: { openToMentor: !!b.value } })
    return NextResponse.json({ success: true, openToMentor: !!b.value })
  }

  const m = await prisma.mentorship.findUnique({ where: { id: String(b.id || "") } })
  if (!m) return NextResponse.json({ error: "Mentorship not found." }, { status: 404 })
  const by = m.mentorId === p.userId ? "mentor" : m.menteeId === p.userId ? "mentee" : null
  if (!by) return NextResponse.json({ error: "Not your mentorship." }, { status: 403 })
  const check = canMentorshipTransition(String(b.action || ""), m.status, by)
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 })
  await prisma.mentorship.update({ where: { id: m.id }, data: { status: check.to, respondedAt: new Date() } })
  // Notify the other party.
  const otherId = by === "mentor" ? m.menteeId : m.mentorId
  await createNotification({ userId: otherId, title: `Mentorship ${check.to?.toLowerCase()}`, body: `A mentorship was ${check.to?.toLowerCase()}.`, link: "/mentoring", sendEmail: false }).catch(() => {})
  return NextResponse.json({ success: true, status: check.to })
}
