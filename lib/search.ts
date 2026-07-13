// In-house full-text search — tokenizer + BM25-lite ranking. No third-party libs.
// Candidates are pre-filtered in SQL (cheap OR-contains), then ranked here so the
// relevance logic is ours end-to-end and scales past a naive "load everything" scan.

export const STOP = new Set(
  "a an the and or of to in for with on at by from as is are be it its this that we you your our their they i he she job jobs role roles work career".split(" ")
)

// Lowercase, strip accents, split on non-alphanumerics, drop stopwords and 1-char noise.
export function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t))
}

export type Field = { text: string; weight: number }

// Score a document (a set of weighted fields) against the query tokens.
// Rewards exact term hits (log term-frequency, weighted by field importance and
// normalised for field length), gives partial credit for prefix matches
// ("eng" → "engineer"), and multiplies by how many query tokens were covered so
// documents that match the whole query rank above those matching only part of it.
export function scoreFields(qTokens: string[], fields: Field[]): number {
  if (!qTokens.length) return 0
  let score = 0
  const covered = new Set<string>()
  for (const f of fields) {
    if (!f.text) continue
    const toks = tokenize(f.text)
    if (!toks.length) continue
    const tf: Record<string, number> = {}
    for (const t of toks) tf[t] = (tf[t] || 0) + 1
    const norm = 1 / Math.sqrt(toks.length) // dampen long fields (BM25-style length normalisation)
    for (const q of qTokens) {
      if (tf[q]) {
        score += f.weight * (1 + Math.log(tf[q])) * norm
        covered.add(q)
      } else if (q.length >= 3) {
        for (const t of toks) {
          if (t.startsWith(q)) { score += f.weight * 0.45 * norm; covered.add(q); break }
        }
      }
    }
  }
  const coverage = covered.size / qTokens.length
  score *= 0.4 + 0.6 * coverage
  if (qTokens.length > 1 && coverage < 1) score *= 0.8 // penalise partial-query matches
  return score
}

// Rank a candidate list, keep the positives, return the top N with their score.
export function rank<T>(items: T[], qTokens: string[], fieldsOf: (x: T) => Field[], take: number): (T & { _score: number })[] {
  return items
    .map((x) => ({ ...(x as any), _score: scoreFields(qTokens, fieldsOf(x)) }))
    .filter((x) => x._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, take)
}
