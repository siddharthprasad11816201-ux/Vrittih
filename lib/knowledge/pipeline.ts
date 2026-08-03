/* AIOS §13 — the continuous knowledge pipeline. Collect -> validate -> normalize
 * -> dedupe (contentHash) -> classify (§14) -> version (never overwrite) -> embed
 * (semantic index §16) -> publish. Also indexes real platform content (active
 * jobs) so retrieval returns real results — no fabricated knowledge.
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §13. */
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { indexDoc, rebuildIndex } from "@/lib/knowledge/semindex"
import { classifyKnowledge, isFact, type Provenance } from "@/lib/knowledge/classify"

const hash = (s: string) => crypto.createHash("sha256").update(s || "").digest("hex")
const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim()

export type IngestInput = { kind: string; title: string; body?: string; provenance: Provenance; owner?: string; securityClass?: string }

/** Ingest one knowledge object: dedupe, classify, version, and index verified
 * facts. Returns the item id + status. Never overwrites history. */
export async function ingestKnowledge(input: IngestInput): Promise<{ itemId: string; status: string; indexed: boolean; deduped: boolean }> {
  const title = norm(input.title)
  const body = norm(input.body || "")
  if (!title) throw new Error("knowledge requires a title")
  const contentHash = hash(`${input.kind}::${title}::${body}`)

  const dup = await prisma.knowledgeItem.findFirst({ where: { contentHash }, select: { id: true, status: true } })
  if (dup) return { itemId: dup.id, status: dup.status, indexed: false, deduped: true }

  const { status, confidence } = classifyKnowledge(input.kind, input.provenance)
  const item = await prisma.knowledgeItem.create({
    data: { kind: input.kind, title, body, contentHash, status, confidence, owner: input.owner ?? null, provenance: JSON.stringify(input.provenance), securityClass: input.securityClass || "internal" },
    select: { id: true },
  })
  await prisma.knowledgeRevision.create({ data: { itemId: item.id, version: 1, status, title, body, changedBy: input.owner ?? null, reason: "ingest" } }).catch(() => {})

  // Only verified facts enter the retrievable index.
  let indexed = false
  if (isFact(status)) {
    await indexDoc("knowledge", item.id, `${title}. ${body}`, "default").catch(() => {})
    indexed = true
  }
  return { itemId: item.id, status, indexed, deduped: false }
}

/** Bulk-index active jobs into the semantic index (real, verified data). This is
 * how `knowledge.search` returns real results. Scales via rebuildIndex. */
export async function reindexJobs(limit = 3000): Promise<{ docs: number; postings: number }> {
  const jobs = await prisma.job.findMany({
    where: { active: true },
    select: { id: true, title: true, company: true, description: true, industry: true, location: true, skills: { include: { skill: true } } },
    take: limit,
  })
  const docs = jobs.map((j) => ({
    refType: "job", refId: j.id,
    text: [j.title, j.company, j.industry, j.location, (j.description || "").slice(0, 4000), (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean).join(" ")].filter(Boolean).join(". "),
  }))
  return rebuildIndex("default", docs)
}

/** Incremental: (re)index a single job on job.created/updated events (§23). */
export async function indexJob(jobId: string): Promise<void> {
  const j = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, title: true, company: true, description: true, industry: true, location: true, active: true, skills: { include: { skill: true } } } }).catch(() => null)
  if (!j) return
  if (!j.active) { const { removeDoc } = await import("@/lib/knowledge/semindex"); await removeDoc("job", jobId, "default").catch(() => {}); return }
  const text = [j.title, j.company, j.industry, j.location, (j.description || "").slice(0, 4000), (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean).join(" ")].filter(Boolean).join(". ")
  await indexDoc("job", jobId, text, "default").catch(() => {})
}
