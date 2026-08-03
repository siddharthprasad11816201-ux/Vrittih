/* AIOS §16 — in-house semantic / vector index. NO external vector DB, NO
 * embeddings API. TF-IDF sparse term vectors + cosine similarity in pure TS; the
 * pure core (tokenize/vector/cosine/rank) is deterministic and unit-testable, and
 * the DB-backed layer persists sparse vectors + an inverted posting list in Prisma
 * (SemanticDoc / SemanticPosting) so retrieval scales without a manual rebuild.
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §16, DDR-003. */
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { tokenize, termFreq, tfidfVector, norm, cosine } from "@/lib/knowledge/tokenize"
export { tokenize, termFreq, tfidfVector, norm, cosine } from "@/lib/knowledge/tokenize"


/** Pure in-memory ranker — the reference implementation the DB layer mirrors.
 * Computes idf across the given corpus, then cosine-ranks docs vs the query. */
export function rank(query: string, docs: { id: string; text: string }[], limit = 10): { id: string; score: number }[] {
  const N = docs.length || 1
  const df: Record<string, number> = {}
  const docTf = docs.map((d) => ({ id: d.id, tf: termFreq(tokenize(d.text)) }))
  for (const d of docTf) for (const term of Object.keys(d.tf)) df[term] = (df[term] || 0) + 1
  const idf = (t: string) => Math.log(1 + (N + 1) / ((df[t] || 0) + 1))
  const qv = tfidfVector(termFreq(tokenize(query)), idf)
  const qn = norm(qv)
  return docTf
    .map((d) => { const dv = tfidfVector(d.tf, idf); return { id: d.id, score: cosine(qv, dv, qn) } })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// DB-backed index (persisted; auto-reindex hooks live in the knowledge pipeline)
// ---------------------------------------------------------------------------

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex")

/** Document frequency for a set of terms in an index, from the posting list. */
async function idfMap(index: string, terms: string[]): Promise<(t: string) => number> {
  const total = await prisma.semanticDoc.count({ where: { index } })
  const N = total || 1
  const df: Record<string, number> = {}
  for (const term of [...new Set(terms)]) {
    df[term] = await prisma.semanticPosting.count({ where: { index, term } })
  }
  return (t: string) => Math.log(1 + (N + 1) / ((df[t] || 0) + 1))
}

/** Index (or re-index) one document. Idempotent by content hash. */
export async function indexDoc(refType: string, refId: string, text: string, index = "default"): Promise<{ indexed: boolean; terms: number }> {
  const ch = hash(text || "")
  const existing = await prisma.semanticDoc.findUnique({ where: { refType_refId_index: { refType, refId, index } }, select: { id: true, contentHash: true } })
  if (existing && existing.contentHash === ch) return { indexed: false, terms: 0 }

  const tf = termFreq(tokenize(text))
  const idf = await idfMap(index, Object.keys(tf))
  const vec = tfidfVector(tf, idf)
  const n = norm(vec)

  const doc = await prisma.semanticDoc.upsert({
    where: { refType_refId_index: { refType, refId, index } },
    update: { vector: JSON.stringify(vec), norm: n, terms: Object.keys(vec).length, contentHash: ch },
    create: { refType, refId, index, vector: JSON.stringify(vec), norm: n, terms: Object.keys(vec).length, contentHash: ch },
    select: { id: true },
  })
  await prisma.semanticPosting.deleteMany({ where: { docId: doc.id } })
  const rows = Object.entries(vec).map(([term, weight]) => ({ index, term, docId: doc.id, weight }))
  if (rows.length) await prisma.semanticPosting.createMany({ data: rows })
  return { indexed: true, terms: rows.length }
}

/** Bulk (re)build an entire named index from a document set. Computes IDF once in
 * memory (O(docs)) and batch-writes docs + postings — the scalable path used by
 * reindex jobs (the per-doc indexDoc is for incremental single-doc updates). */
export async function rebuildIndex(index: string, docs: { refType: string; refId: string; text: string }[]): Promise<{ docs: number; postings: number }> {
  const tokenized = docs.map((d) => ({ refType: d.refType, refId: d.refId, text: d.text, tf: termFreq(tokenize(d.text)) }))
  const df: Record<string, number> = {}
  for (const d of tokenized) for (const t of Object.keys(d.tf)) df[t] = (df[t] || 0) + 1
  const N = tokenized.length || 1
  const idf = (t: string) => Math.log(1 + (N + 1) / ((df[t] || 0) + 1))

  // Clear the existing index (full rebuild).
  await prisma.semanticPosting.deleteMany({ where: { index } })
  await prisma.semanticDoc.deleteMany({ where: { index } })

  const docRows: any[] = []
  const postingRows: any[] = []
  for (const d of tokenized) {
    const vec = tfidfVector(d.tf, idf)
    if (!Object.keys(vec).length) continue
    const id = crypto.randomUUID()
    docRows.push({ id, refType: d.refType, refId: d.refId, index, vector: JSON.stringify(vec), norm: norm(vec), terms: Object.keys(vec).length, contentHash: hash(d.text) })
    for (const [term, weight] of Object.entries(vec)) postingRows.push({ index, term, docId: id, weight })
  }
  for (let i = 0; i < docRows.length; i += 500) await prisma.semanticDoc.createMany({ data: docRows.slice(i, i + 500) })
  for (let i = 0; i < postingRows.length; i += 1000) await prisma.semanticPosting.createMany({ data: postingRows.slice(i, i + 1000) })
  return { docs: docRows.length, postings: postingRows.length }
}

export async function removeDoc(refType: string, refId: string, index = "default") {
  const doc = await prisma.semanticDoc.findUnique({ where: { refType_refId_index: { refType, refId, index } }, select: { id: true } })
  if (!doc) return
  await prisma.semanticPosting.deleteMany({ where: { docId: doc.id } })
  await prisma.semanticDoc.delete({ where: { id: doc.id } })
}

/** Semantic search: candidate retrieval via postings, then cosine re-rank. */
export async function search(query: string, opts: { index?: string; refType?: string; limit?: number } = {}): Promise<{ refType: string; refId: string; score: number }[]> {
  const index = opts.index || "default"
  const limit = opts.limit || 10
  const qTerms = tokenize(query)
  if (!qTerms.length) return []
  const idf = await idfMap(index, qTerms)
  const qv = tfidfVector(termFreq(qTerms), idf)
  const qn = norm(qv)

  // Candidate docs = any doc sharing a query term (inverted index).
  const postings = await prisma.semanticPosting.findMany({ where: { index, term: { in: Object.keys(qv) } }, select: { docId: true } })
  const candidateIds = [...new Set(postings.map((p) => p.docId))]
  if (!candidateIds.length) return []
  const docs = await prisma.semanticDoc.findMany({
    where: { id: { in: candidateIds }, ...(opts.refType ? { refType: opts.refType } : {}) },
    select: { refType: true, refId: true, vector: true, norm: true },
  })
  return docs
    .map((d) => ({ refType: d.refType, refId: d.refId, score: cosine(qv, safe(d.vector), qn, d.norm) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function safe(s: string): Record<string, number> { try { return JSON.parse(s) } catch { return {} } }
