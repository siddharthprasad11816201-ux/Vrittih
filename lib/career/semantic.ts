/* ICIRE — in-house semantic skill relatedness. No external embeddings / NLP libs /
 * LLM. Blends two OWNED sources:
 *
 *   1) the curated ontology — the IMPLY implication graph + category co-membership
 *      from taxonomy.ts (hand-verified, patent-safe relations); and
 *   2) a SELF-TRAINED co-occurrence model (normalised PMI) learned from THIS
 *      platform's own live job corpus (scripts/train-semantic.mjs -> semantic-model.ts) —
 *      data-driven relations the ontology never hand-listed.
 *
 * It exposes skill<->skill relatedness in [0,1], nearest neighbours, and a semantic
 * "effective confidence": a skill a candidate genuinely holds lends decayed, capped
 * credit to the required skills adjacent to it. This is what lets matching understand
 * that Vue transfers toward React, or PyTorch toward Deep Learning — WITHOUT ever
 * overstating, because transfer credit is strictly discounted below real evidence
 * and never turns an unheld skill into a "matched" one. */
import { SKILLS, IMPLY, canonical, categoryOf } from "./taxonomy"
import { MODEL } from "./semantic-model"

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const r2 = (n: number) => Math.round(n * 100) / 100
const cx = (s: string) => canonical(s) || s

type Adj = Map<string, Map<string, number>>
function addEdge(g: Adj, a: string, b: string, w: number) {
  if (a === b || w <= 0) return
  let m = g.get(a)
  if (!m) { m = new Map(); g.set(a, m) }
  m.set(b, Math.max(m.get(b) || 0, w))
}

// ---- 1. Curated ontology edges ----
const IMPLY_FWD = 0.75 // A -> a skill A implies (strong)
const IMPLY_REV = 0.45 // an implied skill -> A (weaker)
const SAME_CAT = 0.3 // baseline for two skills sharing a category
const ONTOLOGY: Adj = (() => {
  const g: Adj = new Map()
  for (const [trigger, targets] of Object.entries(IMPLY)) {
    const a = cx(trigger)
    if (!SKILLS[a]) continue // domain-phrase triggers (e.g. "banking") are not skills
    for (const t of targets) { const b = cx(t); addEdge(g, a, b, IMPLY_FWD); addEdge(g, b, a, IMPLY_REV) }
  }
  const byCat: Record<string, string[]> = {}
  for (const s of Object.keys(SKILLS)) { const c = categoryOf(s); (byCat[c] || (byCat[c] = [])).push(s) }
  for (const list of Object.values(byCat)) for (const a of list) for (const b of list) addEdge(g, a, b, SAME_CAT)
  return g
})()

// ---- 2. Self-trained corpus edges (symmetric nPMI in [0,1]) ----
const CORPUS: Adj = (() => {
  const g: Adj = new Map()
  const pairs = (MODEL && MODEL.pairs) || {}
  for (const key of Object.keys(pairs)) {
    const i = key.indexOf("|")
    if (i < 0) continue
    const a = key.slice(0, i), b = key.slice(i + 1), w = pairs[key]
    addEdge(g, a, b, w); addEdge(g, b, a, w)
  }
  return g
})()
// The learned corpus captures CO-OCCURRENCE (skills that appear in the same jobs),
// which is ideal for "related skills" / recommendations but OVERSTATES transfer
// (working on Authentication doesn't mean you know Redis, even if they co-occur).
// So the corpus is weighted two ways:
//   BLEND    — full weight, for display / recommendations / query understanding;
//   TRANSFER — heavily capped, so co-occurring-but-not-substitutable skills lend
//              only a small nudge to match coverage and can NEVER fabricate a match.
const CORPUS_BLEND = 0.9
const CORPUS_TRANSFER = 0.4

// ---- self-trained embeddings (cosine relatedness), for richer recommendations ----
const VECTORS: Record<string, number[]> = (MODEL && (MODEL as any).vectors) || {}
function cosine(a: string, b: string): number {
  const va = VECTORS[a], vb = VECTORS[b]
  if (!va || !vb) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < va.length; i++) { dot += va[i] * vb[i]; na += va[i] * va[i]; nb += vb[i] * vb[i] }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
/** Embedding cosine relatedness in [0,1] (negative cosines clamped to 0). Powers the
 * "related skills" recommendations; deliberately NOT used for match transfer credit,
 * which stays on the conservative ontology-first path so the honesty caps hold. */
export function vectorRelatedness(a: string, b: string): number {
  const x = cx(a), y = cx(b)
  if (x === y) return 1
  return r2(Math.max(0, cosine(x, y)))
}

function directRel(a: string, b: string, corpusW: number): number {
  const o = ONTOLOGY.get(a)?.get(b) || 0
  const c = (CORPUS.get(a)?.get(b) || 0) * corpusW
  return clamp01(Math.max(o, c))
}
function candidatesOf(a: string): Set<string> {
  const s = new Set<string>()
  for (const k of ONTOLOGY.get(a)?.keys() || []) s.add(k)
  for (const k of CORPUS.get(a)?.keys() || []) s.add(k)
  return s
}

// bounded 2-hop relatedness with decay, memoised per (source skill, corpus weight)
const HOP_DECAY = 0.6, MIN_KEEP = 0.12
const memo: Record<string, Map<string, Map<string, number>>> = {}
function neighborsW(skill: string, corpusW: number): Map<string, number> {
  const bucket = memo[corpusW] || (memo[corpusW] = new Map())
  const a = cx(skill)
  const hit = bucket.get(a)
  if (hit) return hit
  const out = new Map<string, number>()
  const one = new Map<string, number>()
  for (const b of candidatesOf(a)) { const w = directRel(a, b, corpusW); if (w > 0) { one.set(b, w); out.set(b, w) } }
  for (const [b, w1] of one) for (const c of candidatesOf(b)) {
    if (c === a || one.has(c)) continue
    const w = w1 * directRel(b, c, corpusW) * HOP_DECAY
    if (w >= MIN_KEEP) out.set(c, Math.max(out.get(c) || 0, w))
  }
  bucket.set(a, out)
  return out
}

/** Full blended neighbours (ontology + learned co-occurrence) — for recommendations. */
export function neighbors(skill: string): Map<string, number> { return neighborsW(skill, CORPUS_BLEND) }

/** Relatedness of two skills in [0,1] (1 = same skill), blended for display/recs. */
export function relatedness(a: string, b: string): number {
  const x = cx(a), y = cx(b)
  if (x === y) return 1
  return r2(neighbors(x).get(y) || 0)
}

/** Conservative, ontology-first relatedness for match transfer credit. */
export function transferRelatedness(a: string, b: string): number {
  const x = cx(a), y = cx(b)
  if (x === y) return 1
  return r2(neighborsW(x, CORPUS_TRANSFER).get(y) || 0)
}

/** The strongest-related skills to `skill`, most-related first. Merges the graph
 * (ontology + PMI) with self-trained embedding neighbours (cosine), so recommendations
 * are denser than sparse PMI alone. */
export function related(skill: string, min = 0.2, max = 8): { skill: string; weight: number }[] {
  const a = cx(skill)
  const merged = new Map<string, number>()
  for (const [s, w] of neighbors(a)) merged.set(s, Math.max(merged.get(s) || 0, w))
  for (const s of Object.keys(VECTORS)) {
    if (s === a) continue
    const c = Math.max(0, cosine(a, s))
    if (c >= 0.5) merged.set(s, Math.max(merged.get(s) || 0, r2(c)))
  }
  return [...merged].filter(([, w]) => w >= min).sort((p, q) => q[1] - p[1]).slice(0, max).map(([s, w]) => ({ skill: s, weight: r2(w) }))
}

const TRANSFER_DISCOUNT = 0.9 // transfer credit is always < the exact evidence it derives from
export type Effective = { conf: number; via: string | null; exact: boolean }
/** The best confidence a candidate can HONESTLY claim for `target`: their own exact
 * evidence if any, otherwise the strongest decayed transfer from an adjacent held
 * skill (conservative transfer relatedness). `via` names that adjacent skill;
 * `exact` is true only for real, demonstrated evidence. Transfer credit is bounded
 * by conf x transferRelatedness x 0.9, which stays below the 0.4 "matched" cut-off
 * for any purely co-occurring (non-substitutable) skill — so it never fabricates a
 * match, only nudges coverage and surfaces an honest "transferable via X" note. */
export function effectiveConfidence(target: string, held: Map<string, number>): Effective {
  const t = cx(target)
  const exact = held.get(t) || held.get(target) || 0
  let best = exact, via: string | null = null, isExact = exact > 0
  if (exact < 0.85) for (const [s, c] of held) {
    if (cx(s) === t || c <= 0) continue
    const eff = c * transferRelatedness(s, t) * TRANSFER_DISCOUNT
    if (eff > best) { best = eff; via = cx(s); isExact = false }
  }
  return { conf: clamp01(best), via, exact: isExact }
}
