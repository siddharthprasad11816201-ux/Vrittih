import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { canOutputTransition, aggregateReviews, OUTPUT_KINDS, REVIEW_RECS, type OutputAction } from "@/lib/research/lifecycle"
import { citationMetrics, citationCounts } from "@/lib/research/metrics"
import { proficiencyFromEvidence } from "@/lib/learning/competency"
import { indexDoc } from "@/lib/knowledge/semindex"

export const dynamic = "force-dynamic"
const isEditor = (ctx: any) => ctx.has("admin.access") || ctx.has("ai.governance.review")
const jarr = (s?: string | null) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const [projects, myOutputs, reviewQueue, citEdges] = await Promise.all([
    prisma.researchProject.findMany({ where: { ownerId: ctx.userId }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.researchOutput.findMany({ where: { authorId: ctx.userId }, include: { reviews: { select: { recommendation: true, score: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
    // Outputs under review that I can peer-review (not my own, and I haven't reviewed yet).
    prisma.researchOutput.findMany({ where: { status: "UNDER_REVIEW", authorId: { not: ctx.userId }, reviews: { none: { reviewerId: ctx.userId } } }, include: { author: { select: { name: true } } }, orderBy: { updatedAt: "asc" }, take: 50 }),
    prisma.citation.findMany({ select: { fromOutputId: true, toOutputId: true }, take: 50000 }),
  ])
  const counts = citationCounts(citEdges)
  // Bibliometrics count PUBLISHED outputs only (drafts don't accrue citation credit).
  const myMetrics = citationMetrics(myOutputs.filter(o => o.status === "PUBLISHED").map(o => ({ id: o.id, citations: counts[o.id] || 0 })))

  const shapeOut = (o: any) => ({
    id: o.id, title: o.title, kind: o.kind, status: o.status, venue: o.venue, url: o.url, doi: o.doi,
    abstract: o.abstract, projectId: o.projectId, publishedAt: o.publishedAt, createdAt: o.createdAt,
    citations: counts[o.id] || 0, competencies: jarr(o.competencies),
    reviewSummary: o.reviews ? aggregateReviews(o.reviews) : undefined,
    author: o.author ? o.author.name : undefined,
  })
  // Org research analytics (editors only): capability index over published outputs.
  let org: any = null
  if (isEditor(ctx)) {
    const [published, underReview, allCited] = await Promise.all([
      prisma.researchOutput.count({ where: { status: "PUBLISHED" } }),
      prisma.researchOutput.count({ where: { status: "UNDER_REVIEW" } }),
      prisma.researchOutput.findMany({ where: { status: "PUBLISHED" }, select: { id: true }, take: 20000 }),
    ])
    const orgMetrics = citationMetrics((allCited as any[]).map(o => ({ id: o.id, citations: counts[o.id] || 0 })))
    org = { published, underReview, totalCitations: orgMetrics.totalCitations, hIndex: orgMetrics.hIndex, i10Index: orgMetrics.i10Index }
  }

  return NextResponse.json({
    projects: projects.map(p => ({ id: p.id, title: p.title, abstract: p.abstract, field: p.field, status: p.status, competencies: jarr(p.competencies) })),
    outputs: myOutputs.map(shapeOut),
    reviewQueue: reviewQueue.map(shapeOut),
    metrics: myMetrics,
    org,
    kinds: OUTPUT_KINDS, recs: REVIEW_RECS,
    isEditor: isEditor(ctx),
  })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const action = String(b.action || "")

  if (action === "create-project") {
    const title = String(b.title || "").trim()
    if (!title) return NextResponse.json({ error: "Project title required." }, { status: 400 })
    const p = await prisma.researchProject.create({ data: { ownerId: ctx.userId, title: title.slice(0, 240), abstract: b.abstract ? String(b.abstract).slice(0, 5000) : null, field: b.field ? String(b.field).slice(0, 80) : null, competencies: JSON.stringify(Array.isArray(b.competencies) ? b.competencies.slice(0, 20) : []), status: "ACTIVE" } })
    return NextResponse.json({ success: true, id: p.id }, { status: 201 })
  }

  if (action === "create-output") {
    const title = String(b.title || "").trim()
    if (!title) return NextResponse.json({ error: "Output title required." }, { status: 400 })
    const kind = (OUTPUT_KINDS as readonly string[]).includes(b.kind) ? b.kind : "paper"
    // If a project is given, it must be the caller's.
    if (b.projectId) { const p = await prisma.researchProject.findUnique({ where: { id: String(b.projectId) }, select: { ownerId: true } }); if (!p || p.ownerId !== ctx.userId) return NextResponse.json({ error: "Not your project." }, { status: 403 }) }
    const o = await prisma.researchOutput.create({ data: { authorId: ctx.userId, projectId: b.projectId || null, title: title.slice(0, 240), kind, abstract: b.abstract ? String(b.abstract).slice(0, 8000) : null, venue: b.venue ? String(b.venue).slice(0, 160) : null, url: b.url ? String(b.url).slice(0, 500) : null, doi: b.doi ? String(b.doi).slice(0, 120) : null, competencies: JSON.stringify(Array.isArray(b.competencies) ? b.competencies.slice(0, 20) : []), status: "DRAFT" } })
    return NextResponse.json({ success: true, id: o.id }, { status: 201 })
  }

  if (action === "output-action") {
    const out = await prisma.researchOutput.findUnique({ where: { id: String(b.outputId || "") } })
    if (!out) return NextResponse.json({ error: "Output not found." }, { status: 404 })
    const act = String(b.op || "") as OutputAction
    const editor = isEditor(ctx)
    // submit/revise/withdraw are the author's; publish/reject are editorial.
    const authorAction = act === "submit" || act === "revise" || act === "withdraw"
    if (authorAction && out.authorId !== ctx.userId && !editor) return NextResponse.json({ error: "Only the author can do that." }, { status: 403 })
    if ((act === "publish" || act === "reject") && !editor) return NextResponse.json({ error: "Only an editor may publish or reject." }, { status: 403 })
    const check = canOutputTransition(act, out.status, { isEditor: editor })
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 })

    const data: any = { status: check.to }
    if (act === "publish") {
      data.publishedAt = new Date()
      // Index into the knowledge graph (semantic index) + write research-competency evidence.
      await indexDoc("research", out.id, `${out.title}\n${out.abstract || ""}`).catch(() => {})
      const signal = proficiencyFromEvidence([{ source: "project", score: 1 }])
      for (const key of jarr(out.competencies)) {
        const existing = await prisma.userCompetency.findUnique({ where: { userId_competencyKey: { userId: out.authorId, competencyKey: String(key) } }, select: { proficiency: true } }).catch(() => null)
        await prisma.userCompetency.upsert({ where: { userId_competencyKey: { userId: out.authorId, competencyKey: String(key) } }, create: { userId: out.authorId, competencyKey: String(key), proficiency: signal, source: "research", evidenceRef: out.id }, update: { proficiency: Math.max(existing?.proficiency || 0, signal), source: "research", evidenceRef: out.id, assessedAt: new Date() } }).catch(() => {})
      }
    }
    await prisma.researchOutput.update({ where: { id: out.id }, data })
    return NextResponse.json({ success: true, status: check.to })
  }

  if (action === "review") {
    const out = await prisma.researchOutput.findUnique({ where: { id: String(b.outputId || "") }, select: { id: true, authorId: true, status: true } })
    if (!out) return NextResponse.json({ error: "Output not found." }, { status: 404 })
    if (out.authorId === ctx.userId) return NextResponse.json({ error: "You cannot review your own output (conflict of interest)." }, { status: 403 })
    if (out.status !== "UNDER_REVIEW") return NextResponse.json({ error: "This output isn't under review." }, { status: 409 })
    const rec = String(b.recommendation || "").toUpperCase()
    if (!(REVIEW_RECS as readonly string[]).includes(rec)) return NextResponse.json({ error: "Valid recommendation required." }, { status: 400 })
    const score = b.score != null ? Math.max(0, Math.min(10, Math.round(Number(b.score)))) : null
    await prisma.researchReview.upsert({
      where: { outputId_reviewerId: { outputId: out.id, reviewerId: ctx.userId } },
      create: { outputId: out.id, reviewerId: ctx.userId, recommendation: rec, score, comments: b.comments ? String(b.comments).slice(0, 5000) : null },
      update: { recommendation: rec, score, comments: b.comments ? String(b.comments).slice(0, 5000) : null },
    })
    return NextResponse.json({ success: true })
  }

  if (action === "cite") {
    const from = String(b.fromOutputId || "")
    const o = await prisma.researchOutput.findUnique({ where: { id: from }, select: { authorId: true } })
    if (!o || o.authorId !== ctx.userId) return NextResponse.json({ error: "You can only add citations from your own output." }, { status: 403 })
    const toOutputId = b.toOutputId ? String(b.toOutputId) : null
    if (!toOutputId && !b.externalRef) return NextResponse.json({ error: "A cited output or reference is required." }, { status: 400 })
    if (toOutputId) {
      // The target must be a real, PUBLISHED output, and you can't cite your own work
      // (anti-inflation: self-citation can't pump your own bibliometrics).
      const to = await prisma.researchOutput.findUnique({ where: { id: toOutputId }, select: { authorId: true, status: true } })
      if (!to || to.status !== "PUBLISHED") return NextResponse.json({ error: "You can only cite a published output." }, { status: 409 })
      if (to.authorId === ctx.userId) return NextResponse.json({ error: "Self-citation isn't counted." }, { status: 409 })
      // Dedupe: one edge per (from, to).
      const dupe = await prisma.citation.findFirst({ where: { fromOutputId: from, toOutputId } })
      if (dupe) return NextResponse.json({ error: "That citation already exists." }, { status: 409 })
    }
    await prisma.citation.create({ data: { fromOutputId: from, toOutputId, externalRef: b.externalRef ? String(b.externalRef).slice(0, 500) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
