import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { canTransition, type OfferAction } from "@/lib/offer/lifecycle"
import { predictAcceptance } from "@/lib/offer/predict"
import { analyzeCareer } from "@/lib/career/engine"
import { matchJob } from "@/lib/career/match"
import { inputFromUser } from "@/lib/career/fromUser"
import { createNotification } from "@/lib/notify"

export const dynamic = "force-dynamic"

const canManage = (ctx: any) => ctx.has("pipeline.manage") || ctx.has("jobs.post") || ctx.has("admin.access")
const posNum = (v: any): number | null => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }

async function load(id: string) {
  return prisma.offer.findUnique({
    where: { id },
    include: {
      candidate: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const offer = await load(params.id)
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 })
  const isParty = offer.candidateId === ctx.userId || offer.createdById === ctx.userId || ctx.has("admin.access")
  if (!isParty) return NextResponse.json({ error: "Offer not found" }, { status: 404 })
  const isCandidateOnly = offer.candidateId === ctx.userId && offer.createdById !== ctx.userId && !ctx.has("admin.access")
  // A candidate can only see an offer that was ACTUALLY sent (sentAt is set solely on
  // send) — not a drafted-then-withdrawn one that was never extended.
  if (isCandidateOnly && !offer.sentAt) return NextResponse.json({ error: "Offer not found" }, { status: 404 })
  // Redact internal fields (recruiter notes, supersede lineage, event actor ids) from
  // the candidate — mirror what the list projection strips.
  if (isCandidateOnly) {
    const { notes, supersededById, createdById, ...rest } = offer as any
    return NextResponse.json({ offer: { ...rest, events: (offer.events || []).map((e: any) => ({ action: e.action, note: e.note, createdAt: e.createdAt })) } })
  }
  return NextResponse.json({ offer })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })

  const offer = await load(params.id)
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 })
  const isAdmin = ctx.has("admin.access")
  if (offer.createdById !== ctx.userId && !isAdmin) {
    return NextResponse.json({ error: "You can only manage offers you created." }, { status: 403 })
  }

  const b = await req.json()
  const action = String(b.action || "") as OfferAction | "edit"

  // Edit compensation while still a draft (never after it leaves the building).
  if (action === "edit") {
    if (offer.status !== "DRAFT") return NextResponse.json({ error: "Only a draft offer can be edited." }, { status: 409 })
    const benefits: string[] = Array.isArray(b.benefits) ? b.benefits.map((x: any) => String(x).slice(0, 120)).slice(0, 20) : undefined as any
    const updated = await prisma.offer.update({
      where: { id: offer.id },
      data: {
        title: b.title != null ? String(b.title).slice(0, 200) : undefined,
        baseAmount: b.baseAmount != null ? posNum(b.baseAmount) : undefined,
        currency: b.currency != null ? String(b.currency).slice(0, 8).toUpperCase() : undefined,
        bonusAmount: b.bonusAmount != null ? posNum(b.bonusAmount) : undefined,
        equity: b.equity != null ? String(b.equity).slice(0, 120) : undefined,
        benefits: benefits != null ? (benefits.length ? JSON.stringify(benefits) : null) : undefined,
        startDate: b.startDate != null ? (b.startDate ? new Date(b.startDate) : null) : undefined,
        expiresAt: b.expiresAt != null ? (b.expiresAt ? new Date(b.expiresAt) : null) : undefined,
        notes: b.notes != null ? String(b.notes).slice(0, 4000) : undefined,
      },
    })
    return NextResponse.json({ success: true, offer: updated })
  }

  const isApproverDistinct = offer.createdById !== ctx.userId
  const check = canTransition(action as OfferAction, offer.status, { isApproverDistinct, isAdmin, sendRequiresApproval: true })
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 })

  const uid: string = ctx.userId   // narrowed non-null above; stable inside closures

  // ---- revise: retire this offer, spawn a fresh DRAFT one version higher.
  // Atomic: the new version and the retirement of the old one commit together. ----
  if (action === "revise") {
    const fresh = await prisma.$transaction(async (tx) => {
      const created = await tx.offer.create({
        data: {
          applicationId: offer.applicationId, candidateId: offer.candidateId, jobId: offer.jobId,
          createdById: uid, title: offer.title, companyName: offer.companyName, status: "DRAFT",
          baseAmount: offer.baseAmount, currency: offer.currency, bonusAmount: offer.bonusAmount,
          equity: offer.equity, benefits: offer.benefits, startDate: offer.startDate, expiresAt: offer.expiresAt,
          version: offer.version + 1, notes: offer.notes,
          events: { create: { action: "created", actorId: uid, note: `Revised from v${offer.version}` } },
        },
      })
      await tx.offer.update({ where: { id: offer.id }, data: { status: "WITHDRAWN", supersededById: created.id, events: { create: { action: "revised", actorId: uid, note: `Superseded by v${created.version}` } } } })
      return created
    })
    return NextResponse.json({ success: true, offer: fresh, revisedTo: fresh.id })
  }

  const data: any = { status: check.to, events: { create: { action, actorId: ctx.userId, note: b.note || null } } }

  if (action === "approve") { data.approvedById = ctx.userId; data.approvedAt = new Date() }

  if (action === "send") {
    // Deterministic acceptance prediction snapshot at send time.
    let matchScore: number | null = null
    if (offer.jobId) {
      try {
        const skills = analyzeCareer(await inputFromUser(offer.candidateId)).skills
        const job = await prisma.job.findUnique({ where: { id: offer.jobId }, select: { title: true, description: true, industry: true, skills: { include: { skill: true } } } })
        if (job) matchScore = matchJob(skills, { title: job.title, description: job.description, industry: job.industry, skills: (job.skills || []).map((s: any) => s.skill?.name).filter(Boolean) }).overall
      } catch { /* prediction degrades gracefully without a match signal */ }
    }
    const benefitsCount = offer.benefits ? (() => { try { return JSON.parse(offer.benefits!).length } catch { return 0 } })() : 0
    const pred = predictAcceptance({
      matchScore,
      hasBaseComp: offer.baseAmount != null,
      hasBonusOrEquity: !!(offer.bonusAmount || offer.equity),
      responseWindowDays: offer.expiresAt ? Math.round((+offer.expiresAt - Date.now()) / 864e5) : null,
      benefitsCount,
    })
    data.acceptScore = pred.score
    data.acceptFactors = JSON.stringify({ band: pred.band, factors: pred.factors, confidence: pred.confidence, note: pred.note })
    data.sentAt = new Date()
    await createNotification({
      userId: offer.candidateId,
      title: `You've received an offer — ${offer.title}`,
      body: `${offer.companyName} has sent you an offer. Review and respond.`,
      link: "/offers", sendEmail: false,
    }).catch(() => {})
  }

  if (action === "withdraw") {
    await createNotification({ userId: offer.candidateId, title: `Offer withdrawn — ${offer.title}`, body: `${offer.companyName} has withdrawn this offer.`, link: "/offers", sendEmail: false }).catch(() => {})
  }

  const updated = await prisma.offer.update({ where: { id: offer.id }, data })
  return NextResponse.json({ success: true, offer: updated })
}
