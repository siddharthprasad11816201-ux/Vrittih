/* Citation Intelligence — in-house bibliometrics. PURE, testable.
 *
 * Phase 3, Module 4. Deterministic h-index / i10 / totals from a set of outputs' citation
 * counts. Honest about sparse data. No external services.
 */

export interface CitedOutput { id?: string; citations: number }
export interface CitationMetrics {
  outputs: number
  totalCitations: number
  hIndex: number       // max h s.t. h outputs have >= h citations each
  i10Index: number     // # outputs with >= 10 citations
  maxCitations: number
  meanCitations: number
}

export function citationMetrics(outputs: CitedOutput[]): CitationMetrics {
  const counts = outputs.map(o => Math.max(0, Math.floor(o.citations || 0))).sort((a, b) => b - a)
  const total = counts.reduce((a, b) => a + b, 0)
  let h = 0
  for (let i = 0; i < counts.length; i++) { if (counts[i] >= i + 1) h = i + 1; else break }
  const i10 = counts.filter(c => c >= 10).length
  return {
    outputs: counts.length,
    totalCitations: total,
    hIndex: h,
    i10Index: i10,
    maxCitations: counts[0] || 0,
    meanCitations: counts.length ? +(total / counts.length).toFixed(1) : 0,
  }
}

/* Build a simple citation-graph summary: in-degree (times cited) per output id, from a
 * list of citation edges (from → to). External refs (no toId) are ignored for in-degree. */
export function citationCounts(edges: { fromOutputId: string; toOutputId?: string | null }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const e of edges) { if (e.toOutputId) counts[e.toOutputId] = (counts[e.toOutputId] || 0) + 1 }
  return counts
}
