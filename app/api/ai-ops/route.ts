import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { MODELS, CAPABILITIES, AGENTS } from "@/lib/aios"

export const dynamic = "force-dynamic"

/* AIOS §29 — unified AI Operations observability. Admin-gated. Aggregates the
 * AiRun audit, event bus, knowledge/memory/semantic stores and registries into a
 * single operations view. All counts are real (no fabricated metrics). */

export async function GET(req: NextRequest) {
  const ctx = requireAdmin(req)
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const since = new Date(Date.now() - 7 * 86400000)
  const [runsTotal, runs7d, runsOk, runsErr, runsDenied, byCap, events, eventsPending, knowledge, knowledgeVerified, semDocs, memory, evalRuns, proposalsPending, recs, feedback] = await Promise.all([
    prisma.aiRun.count().catch(() => 0),
    prisma.aiRun.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.aiRun.count({ where: { status: "ok" } }).catch(() => 0),
    prisma.aiRun.count({ where: { status: "error" } }).catch(() => 0),
    prisma.aiRun.count({ where: { status: { in: ["denied", "blocked"] } } }).catch(() => 0),
    prisma.aiRun.groupBy({ by: ["capId"], _count: { capId: true }, orderBy: { _count: { capId: "desc" } }, take: 10 }).catch(() => [] as any),
    prisma.platformEvent.count().catch(() => 0),
    prisma.platformEvent.count({ where: { processed: false } }).catch(() => 0),
    prisma.knowledgeItem.count().catch(() => 0),
    prisma.knowledgeItem.count({ where: { status: "verified" } }).catch(() => 0),
    prisma.semanticDoc.count().catch(() => 0),
    prisma.memoryEntry.count().catch(() => 0),
    prisma.evalRun.findMany({ orderBy: { createdAt: "desc" }, take: 12 }).catch(() => [] as any),
    prisma.changeProposal.count({ where: { status: "pending" } }).catch(() => 0),
    prisma.recommendation.count().catch(() => 0),
    prisma.recommendationFeedback.count().catch(() => 0),
  ])

  const recent = await prisma.aiRun.findMany({ orderBy: { createdAt: "desc" }, take: 15, select: { capId: true, modelId: true, status: true, latencyMs: true, createdAt: true } }).catch(() => [] as any)

  return NextResponse.json({
    execution: { total: runsTotal, last7d: runs7d, ok: runsOk, error: runsErr, deniedOrBlocked: runsDenied, successRate: runsTotal ? Math.round((runsOk / runsTotal) * 100) : null, byCapability: byCap.map((c: any) => ({ capId: c.capId, count: c._count.capId })) },
    events: { total: events, pending: eventsPending },
    knowledge: { items: knowledge, verified: knowledgeVerified, semanticDocs: semDocs },
    memory: { entries: memory },
    recommendations: { total: recs, feedback },
    evaluation: evalRuns.map((e: any) => ({ metric: e.metric, scope: e.scope, value: e.value, at: e.createdAt })),
    governance: { pendingProposals: proposalsPending },
    registries: { models: MODELS.length, capabilities: CAPABILITIES.length, agents: AGENTS.length },
    recentRuns: recent,
  })
}
