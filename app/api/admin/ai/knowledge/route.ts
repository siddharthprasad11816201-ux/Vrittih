import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCapability } from "@/lib/capability/context"
import { logAction } from "@/lib/admin"
import { reindexJobs } from "@/lib/knowledge/pipeline"

export const dynamic = "force-dynamic"

/* AIOS §13/§16 — knowledge governance ops. Capability-gated on `ai.governance.review`.
 * GET: knowledge + index health. POST {action:"reindex-jobs"}: rebuild the semantic
 * index from real active jobs (verified data) so knowledge.search returns results. */

export async function GET(req: NextRequest) {
  const ctx = await requireCapability(req, "ai.governance.review")
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const [byStatus, semDocs, semByType] = await Promise.all([
    prisma.knowledgeItem.groupBy({ by: ["status"], _count: { status: true } }).catch(() => [] as any),
    prisma.semanticDoc.count().catch(() => 0),
    prisma.semanticDoc.groupBy({ by: ["refType"], _count: { refType: true } }).catch(() => [] as any),
  ])
  return NextResponse.json({
    knowledge: byStatus.map((s: any) => ({ status: s.status, count: s._count.status })),
    semanticIndex: { docs: semDocs, byType: semByType.map((t: any) => ({ refType: t.refType, count: t._count.refType })) },
  })
}

export async function POST(req: NextRequest) {
  const ctx = await requireCapability(req, "ai.governance.review")
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  if (body?.action !== "reindex-jobs") return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  const result = await reindexJobs()
  await logAction(ctx.userId!, "ai.knowledge.reindex-jobs", result, req).catch(() => {})
  return NextResponse.json({ ok: true, ...result })
}
