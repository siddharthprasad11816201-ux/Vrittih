import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"

export const dynamic = "force-dynamic"

/* EROS Module 8 — Offer Management.
 * GET  → the caller's offers: { created } (as a recruiter/manager) + { received } (as a
 *        candidate). POST → create a DRAFT offer (capability-gated). */

const canManage = (ctx: any) => ctx.has("pipeline.manage") || ctx.has("jobs.post") || ctx.has("admin.access")

function shape(o: any) {
  return {
    id: o.id, status: o.status, title: o.title, companyName: o.companyName,
    baseAmount: o.baseAmount, currency: o.currency, bonusAmount: o.bonusAmount,
    equity: o.equity, benefits: o.benefits ? safeArr(o.benefits) : [],
    startDate: o.startDate, expiresAt: o.expiresAt, version: o.version,
    acceptScore: o.acceptScore, acceptFactors: o.acceptFactors ? safeJson(o.acceptFactors) : null,
    sentAt: o.sentAt, respondedAt: o.respondedAt, declineReason: o.declineReason,
    approvedById: o.approvedById, approvedAt: o.approvedAt,
    createdAt: o.createdAt, applicationId: o.applicationId, jobId: o.jobId,
    candidate: o.candidate ? { id: o.candidate.id, name: o.candidate.name, email: o.candidate.email } : null,
    createdBy: o.createdBy ? { id: o.createdBy.id, name: o.createdBy.name } : null,
    events: (o.events || []).map((e: any) => ({ action: e.action, note: e.note, createdAt: e.createdAt })),
  }
}
const safeArr = (s: string) => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] } }
const safeJson = (s: string) => { try { return JSON.parse(s) } catch { return null } }

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const inc = {
    candidate: { select: { id: true, name: true, email: true } },
    createdBy: { select: { id: true, name: true } },
    events: { orderBy: { createdAt: "asc" as const } },
  }
  // A candidate only ever sees offers that were ACTUALLY sent to them. sentAt is set
  // solely by the send action, so it's the correct "was this extended?" signal — a
  // drafted-then-withdrawn offer (never sent) must never surface its compensation.
  const received = await prisma.offer.findMany({
    where: { candidateId: ctx.userId, sentAt: { not: null } },
    include: inc, orderBy: { updatedAt: "desc" }, take: 100,
  })
  let created: any[] = []
  if (canManage(ctx)) {
    created = await prisma.offer.findMany({
      where: ctx.has("admin.access") ? {} : { createdById: ctx.userId },
      include: inc, orderBy: { updatedAt: "desc" }, take: 200,
    })
  }
  return NextResponse.json({ created: created.map(shape), received: received.map(shape), canManage: canManage(ctx), isAdmin: ctx.has("admin.access") })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access to create offers." }, { status: 403 })

  const b = await req.json()
  // Resolve the candidate: from an application, an explicit id, or an email.
  let candidateId: string | null = b.candidateId || null
  let applicationId: string | null = b.applicationId || null
  let jobId: string | null = b.jobId || null
  let title: string = String(b.title || "").trim()
  let companyName: string = String(b.companyName || "").trim()

  if (applicationId) {
    const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { userId: true, jobId: true, job: { select: { title: true, company: true, postedById: true } } } })
    if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 })
    // Managers may only offer against their own jobs (unless admin).
    if (!ctx.has("admin.access") && app.job?.postedById !== ctx.userId) {
      return NextResponse.json({ error: "You can only make offers for your own jobs." }, { status: 403 })
    }
    candidateId = app.userId; jobId = app.jobId   // derive strictly from the ownership-checked application; never let client jobId override
    title = title || app.job?.title || "Offer"
    companyName = companyName || app.job?.company || ""
  } else {
    if (!candidateId && b.candidateEmail) {
      const u = await prisma.user.findUnique({ where: { email: String(b.candidateEmail).toLowerCase() }, select: { id: true } })
      if (!u) return NextResponse.json({ error: "No user found with that email." }, { status: 404 })
      candidateId = u.id
    }
    // A client-supplied jobId must belong to the caller (unless admin) — never trust it.
    if (jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId }, select: { postedById: true, title: true, company: true } })
      if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 })
      if (!ctx.has("admin.access") && job.postedById !== ctx.userId) {
        return NextResponse.json({ error: "You can only make offers for your own jobs." }, { status: 403 })
      }
      title = title || job.title || ""
      companyName = companyName || job.company || ""
    }
  }
  if (!candidateId) return NextResponse.json({ error: "A candidate (application, id, or email) is required." }, { status: 400 })
  if (!title) return NextResponse.json({ error: "An offer title is required." }, { status: 400 })

  const benefits: string[] = Array.isArray(b.benefits) ? b.benefits.map((x: any) => String(x).slice(0, 120)).slice(0, 20) : []
  const offer = await prisma.offer.create({
    data: {
      applicationId, candidateId, jobId, createdById: ctx.userId,
      title: title.slice(0, 200), companyName: companyName.slice(0, 160),
      status: "DRAFT",
      baseAmount: num(b.baseAmount), currency: String(b.currency || "CHF").slice(0, 8).toUpperCase(),
      bonusAmount: num(b.bonusAmount), equity: b.equity ? String(b.equity).slice(0, 120) : null,
      benefits: benefits.length ? JSON.stringify(benefits) : null,
      startDate: dt(b.startDate), expiresAt: dt(b.expiresAt),
      notes: b.notes ? String(b.notes).slice(0, 4000) : null,
      events: { create: { action: "created", actorId: ctx.userId, note: "Offer drafted" } },
    },
    include: { candidate: { select: { id: true, name: true, email: true } }, createdBy: { select: { id: true, name: true } }, events: true },
  })
  return NextResponse.json({ success: true, offer: shape(offer) }, { status: 201 })
}

function num(v: any): number | null { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
function dt(v: any): Date | null { if (!v) return null; const d = new Date(v); return isNaN(+d) ? null : d }
