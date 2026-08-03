/* AIOS §16 — the pure tokenizer + TF-IDF vector math. Dependency-free so both the
 * runtime semantic index (lib/knowledge/semindex.ts) and offline reindex scripts
 * share ONE tokenizer (no drift, no duplication). */

const STOP = new Set("a an the and or but if then else of to in on at for with without from by as is are was were be been being this that these those it its it's you your we our they their he she his her i me my not no do does did will would can could should has have had".split(" "))

export function tokenize(text: string): string[] {
  return (text || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9+#.]+/).map((t) => t.replace(/^[.]+|[.]+$/g, ""))
    .filter((t) => t.length >= 2 && t.length <= 40 && !STOP.has(t) && !/^\d+$/.test(t))
}

export function termFreq(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {}
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1
  return tf
}

export function tfidfVector(tf: Record<string, number>, idf: (term: string) => number): Record<string, number> {
  const v: Record<string, number> = {}
  for (const [term, count] of Object.entries(tf)) {
    const w = (1 + Math.log(count)) * idf(term)
    if (w > 0) v[term] = w
  }
  return v
}

export const norm = (v: Record<string, number>) => Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0)) || 0

export function cosine(a: Record<string, number>, b: Record<string, number>, na?: number, nb?: number): number {
  const [small, large] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a]
  let dot = 0
  for (const k in small) if (k in large) dot += small[k] * large[k]
  const d = (na ?? norm(a)) * (nb ?? norm(b))
  return d ? dot / d : 0
}
