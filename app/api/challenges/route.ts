import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { createNotification } from "@/lib/notify"

export const dynamic = "force-dynamic"
const canSponsor = (ctx: any) => ctx.has("admin.access") || ctx.has("jobs.post") || ctx.has("ai.ops.view")
const SUB_STATUS = ["SUBMITTED", "SHORTLISTED", "WINNER", "REJECTED"]

/* Phase 3 Module 7 — Innovation Challenges. Anyone browses open challenges + submits;
 * sponsors/admins create challenges and judge submissions. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const [open, mineSubs, sponsored] = await Promise.all([
    prisma.innovationChallenge.findMany({ where: { status: { in: ["OPEN", "JUDGING"] } }, include: { sponsor: { select: { name: true } }, _count: { select: { submissions: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.challengeSubmission.findMany({ where: { userId: ctx.userId }, include: { challenge: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    canSponsor(ctx) ? prisma.innovationChallenge.findMany({ where: { sponsorId: ctx.userId }, include: { submissions: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 }) : Promise.resolve([] as any[]),
  ])
  const subSet = new Set(mineSubs.map(s => s.challengeId))
  return NextResponse.json({
    open: open.map(c => ({ id: c.id, title: c.title, description: c.description, prize: c.prize, status: c.status, deadline: c.deadline, submissions: c._count.submissions, sponsor: c.sponsor?.name, submitted: subSet.has(c.id) })),
    mySubmissions: mineSubs.map(s => ({ id: s.id, status: s.status, challenge: s.challenge?.title, title: s.title })),
    sponsored: sponsored.map((c: any) => ({ id: c.id, title: c.title, status: c.status, submissions: (c.submissions || []).map((s: any) => ({ id: s.id, by: s.user?.name, title: s.title, status: s.status, url: s.url })) })),
    canSponsor: canSponsor(ctx),
  })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  if (b.action === "submit") {
    const ch = await prisma.innovationChallenge.findUnique({ where: { id: String(b.challengeId || "") }, select: { id: true, status: true, sponsorId: true, title: true } })
    if (!ch || ch.status !== "OPEN") return NextResponse.json({ error: "Challenge not open." }, { status: 409 })
    const title = String(b.title || "").trim()
    if (!title) return NextResponse.json({ error: "Submission title required." }, { status: 400 })
    const dupe = await prisma.challengeSubmission.findFirst({ where: { challengeId: ch.id, userId: ctx.userId } })
    if (dupe) return NextResponse.json({ error: "You already submitted." }, { status: 409 })
    await prisma.challengeSubmission.create({ data: { challengeId: ch.id, userId: ctx.userId, title: title.slice(0, 200), summary: b.summary ? String(b.summary).slice(0, 4000) : null, url: b.url ? String(b.url).slice(0, 500) : null, status: "SUBMITTED" } })
    await createNotification({ userId: ch.sponsorId, title: `New submission — ${ch.title}`, body: "A new challenge submission arrived.", link: "/innovation", sendEmail: false }).catch(() => {})
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (!canSponsor(ctx)) return NextResponse.json({ error: "Creating challenges requires sponsor/admin access." }, { status: 403 })
  const title = String(b.title || "").trim()
  if (!title) return NextResponse.json({ error: "Challenge title required." }, { status: 400 })
  const c = await prisma.innovationChallenge.create({ data: { sponsorId: ctx.userId, title: title.slice(0, 240), description: b.description ? String(b.description).slice(0, 5000) : null, prize: b.prize ? String(b.prize).slice(0, 160) : null, deadline: b.deadline ? new Date(b.deadline) : null, status: "OPEN" } })
  return NextResponse.json({ success: true, id: c.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const status = String(b.status || "").toUpperCase()
  if (!SUB_STATUS.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
  const sub = await prisma.challengeSubmission.findUnique({ where: { id: String(b.id || "") }, include: { challenge: { select: { sponsorId: true } } } })
  if (!sub) return NextResponse.json({ error: "Submission not found." }, { status: 404 })
  if (sub.challenge.sponsorId !== ctx.userId && !ctx.has("admin.access")) return NextResponse.json({ error: "Only the sponsor may judge." }, { status: 403 })
  await prisma.challengeSubmission.update({ where: { id: sub.id }, data: { status } })
  await createNotification({ userId: sub.userId, title: `Submission ${status.toLowerCase()}`, body: `Your challenge submission was ${status.toLowerCase()}.`, link: "/innovation", sendEmail: false }).catch(() => {})
  return NextResponse.json({ success: true })
}
