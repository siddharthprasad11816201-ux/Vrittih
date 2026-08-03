/* AIOS §25 — self-evaluation. Computes REAL platform metrics from the audit,
 * index and knowledge stores (no fabricated numbers) and records them as EvalRun
 * rows so trends accrue over time. Run from the AI cron (§23/§25). */
import { prisma } from "@/lib/prisma"

async function record(metric: string, scope: string, value: number, sampleSize: number, detail: Record<string, unknown> = {}) {
  await prisma.evalRun.create({ data: { metric, scope, value, sampleSize, detail: JSON.stringify(detail) } }).catch(() => {})
}

/** Compute + persist the current self-evaluation snapshot. Returns the metrics. */
export async function runSelfEval(): Promise<Record<string, number | null>> {
  const since = new Date(Date.now() - 7 * 86400000)
  const [total7d, ok7d, denied7d, err7d, semDocs, kTotal, kVerified, kRecent, mem, recs, fb] = await Promise.all([
    prisma.aiRun.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.aiRun.count({ where: { createdAt: { gte: since }, status: "ok" } }).catch(() => 0),
    prisma.aiRun.count({ where: { createdAt: { gte: since }, status: { in: ["denied", "blocked"] } } }).catch(() => 0),
    prisma.aiRun.count({ where: { createdAt: { gte: since }, status: "error" } }).catch(() => 0),
    prisma.semanticDoc.count().catch(() => 0),
    prisma.knowledgeItem.count().catch(() => 0),
    prisma.knowledgeItem.count({ where: { status: "verified" } }).catch(() => 0),
    prisma.knowledgeItem.count({ where: { updatedAt: { gte: new Date(Date.now() - 30 * 86400000) } } }).catch(() => 0),
    prisma.memoryEntry.count().catch(() => 0),
    prisma.recommendation.count().catch(() => 0),
    prisma.recommendationFeedback.count().catch(() => 0),
  ])

  const execSuccess = total7d ? ok7d / total7d : null
  const knowledgeVerifiedRatio = kTotal ? kVerified / kTotal : null
  const knowledgeFreshness = kTotal ? kRecent / kTotal : null
  const feedbackCoverage = recs ? fb / recs : null

  if (execSuccess !== null) await record("execution_success_rate", "global", execSuccess, total7d, { ok: ok7d, denied: denied7d, error: err7d })
  await record("semantic_index_size", "global", semDocs, semDocs)
  await record("memory_entries", "global", mem, mem)
  if (knowledgeVerifiedRatio !== null) await record("knowledge_verified_ratio", "global", knowledgeVerifiedRatio, kTotal)
  if (knowledgeFreshness !== null) await record("knowledge_freshness", "global", knowledgeFreshness, kTotal)
  if (feedbackCoverage !== null) await record("recommendation_feedback_coverage", "global", feedbackCoverage, recs)

  return { execution_success_rate: execSuccess, semantic_index_size: semDocs, memory_entries: mem, knowledge_verified_ratio: knowledgeVerifiedRatio, knowledge_freshness: knowledgeFreshness, recommendation_feedback_coverage: feedbackCoverage }
}
