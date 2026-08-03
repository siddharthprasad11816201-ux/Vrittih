import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { resolveContext } from "@/lib/capability/context"
import { createNotification } from "@/lib/notify"

export const dynamic = "force-dynamic"
const REF_STATUS = ["SUBMITTED", "REVIEWING", "INTERVIEWING", "HIRED", "REJECTED"]

/* EROS Module 4 — referral network. Any signed-in user may refer a candidate; recruiters
 * see referrals for their jobs and can advance status. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const canManage = ctx.has("pipeline.manage") || ctx.has("jobs.post") || ctx.has("admin.access")

  // My own referrals, plus (for recruiters) referrals against my jobs.
  const mine = await prisma.referral.findMany({ where: { referrerId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 100 })
  let incoming: any[] = []
  if (canManage) {
    const myJobs = ctx.has("admin.access") ? null : await prisma.job.findMany({ where: { postedById: ctx.userId }, select: { id: true }, take: 2000 })
    incoming = await prisma.referral.findMany({
      where: ctx.has("admin.access") ? {} : { jobId: { in: (myJobs || []).map(j => j.id) } },
      include: { referrer: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200,
    })
  }
  const shape = (r: any) => ({ id: r.id, candidateEmail: r.candidateEmail, candidateName: r.candidateName, jobId: r.jobId, relationship: r.relationship, status: r.status, note: r.note, createdAt: r.createdAt, referrer: r.referrer?.name })
  return NextResponse.json({ mine: mine.map(shape), incoming: incoming.map(shape), canManage })
}

export async function POST(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const email = String(b.candidateEmail || "").toLowerCase().trim()
  if (!email || !/.+@.+\..+/.test(email)) return NextResponse.json({ error: "A valid candidate email is required." }, { status: 400 })
  const referral = await prisma.referral.create({
    data: {
      referrerId: p.userId, candidateEmail: email,
      candidateName: b.candidateName ? String(b.candidateName).slice(0, 160) : null,
      jobId: b.jobId ? String(b.jobId) : null,
      relationship: b.relationship ? String(b.relationship).slice(0, 200) : null,
      note: b.note ? String(b.note).slice(0, 2000) : null, status: "SUBMITTED",
    },
  })
  // Notify the job owner, if this referral targets a specific job.
  if (referral.jobId) {
    const job = await prisma.job.findUnique({ where: { id: referral.jobId }, select: { postedById: true, title: true } }).catch(() => null)
    if (job) await createNotification({ userId: job.postedById, title: `New referral — ${job.title}`, body: `A candidate was referred for ${job.title}.`, link: "/talent", sendEmail: false }).catch(() => {})
  }
  return NextResponse.json({ success: true, id: referral.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!(ctx.has("pipeline.manage") || ctx.has("jobs.post") || ctx.has("admin.access"))) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const b = await req.json()
  const status = String(b.status || "").toUpperCase()
  if (!REF_STATUS.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
  const ref = await prisma.referral.findUnique({ where: { id: String(b.id) }, select: { id: true, jobId: true } })
  if (!ref) return NextResponse.json({ error: "Referral not found." }, { status: 404 })
  // Only the owner of the referral's job (or admin) may advance it.
  if (!ctx.has("admin.access")) {
    if (!ref.jobId) return NextResponse.json({ error: "Not authorized." }, { status: 403 })
    const job = await prisma.job.findUnique({ where: { id: ref.jobId }, select: { postedById: true } })
    if (!job || job.postedById !== ctx.userId) return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }
  await prisma.referral.update({ where: { id: ref.id }, data: { status } })
  return NextResponse.json({ success: true })
}
