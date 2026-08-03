import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { seedMilestones, completionPct } from "@/lib/internship"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const shape = (i: any) => ({
  id: i.id, title: i.title, companyName: i.companyName, track: i.track, cohort: i.cohort,
  status: i.status, ppoStatus: i.ppoStatus, startedAt: i.startedAt, durationWeeks: i.durationWeeks,
  stipendAmount: i.stipendAmount, stipendCurrency: i.stipendCurrency,
  completionPct: i.milestones ? completionPct(i.milestones) : i.completionPct,
  intern: i.user ? { id: i.user.id, name: i.user.name } : undefined,
  mentor: i.mentor ? { id: i.mentor.id, name: i.mentor.name } : null,
  milestones: (i.milestones || []).map((m: any) => ({ id: m.id, week: m.week, title: m.title, status: m.status, dueAt: m.dueAt, completedAt: m.completedAt, note: m.note })),
})

// Internships the caller is the intern on, mentors, or (employer/admin) created.
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const where: any = { OR: [{ userId: ctx.userId }, { mentorId: ctx.userId }] }
  if (ctx.has("jobs.post") || ctx.has("admin.access")) where.OR.push({ createdById: ctx.userId })
  const list = await prisma.internship.findMany({
    where, orderBy: { createdAt: "desc" },
    include: { milestones: { orderBy: { week: "asc" } }, user: { select: { id: true, name: true } }, mentor: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ internships: list.map(shape) })
}

// Create an internship (employer/admin) and seed the weekly roadmap.
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!(ctx.has("jobs.post") || ctx.has("admin.access"))) return NextResponse.json({ error: "Only employers or admins can set up internships." }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const title = String(b?.title || "").trim()
  if (title.length < 3) return NextResponse.json({ error: "An internship title is required." }, { status: 400 })
  const intern = b?.email ? await prisma.user.findUnique({ where: { email: String(b.email).toLowerCase().trim() }, select: { id: true } }) : null
  if (!intern) return NextResponse.json({ error: "No Vrittih user found for that email — the intern needs an account first." }, { status: 404 })
  const mentor = b?.mentorEmail ? await prisma.user.findUnique({ where: { email: String(b.mentorEmail).toLowerCase().trim() }, select: { id: true } }) : null

  const durationWeeks = Math.max(1, Math.min(52, Number(b?.durationWeeks) || 8))
  const startedAt = new Date()
  const created = await prisma.internship.create({
    data: {
      userId: intern.id, mentorId: mentor?.id || null, createdById: ctx.userId,
      companyName: String(b?.companyName || ctx.user?.name || "Company"), title,
      track: b?.track ? String(b.track) : null, cohort: b?.cohort ? String(b.cohort) : null,
      jobId: b?.jobId || null, durationWeeks, startedAt,
      stipendAmount: b?.stipendAmount != null ? Number(b.stipendAmount) : null,
      stipendCurrency: b?.stipendCurrency || "INR",
      milestones: { create: seedMilestones(durationWeeks, startedAt) },
    },
    include: { milestones: { orderBy: { week: "asc" } }, user: { select: { id: true, name: true } }, mentor: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ internship: shape(created) })
}
