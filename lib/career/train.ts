/* ICIRE — pure, in-house trainer for the self-trained semantic skill model. Given
 * skill-sets (one per "document" — a job, a candidate profile, a course), it learns
 * skill<->skill relatedness as normalised pointwise mutual information (nPMI) over
 * how skills genuinely co-occur. NO external libs/models/LLM: pure statistics.
 *
 * Deliberately pure + dependency-free so the SAME math backs both the CLI trainer
 * (scripts/train-semantic.mjs) and the runtime retrainer (/api/cron/train-semantic) —
 * identical results either way — and so it is directly unit-testable. */

export type TrainedModel = {
  trained: { docs: number; skills: number; pairs: number; dims?: number; sources?: Record<string, number>; at: string } | null
  pairs: Record<string, number>          // "SkillA|SkillB" (A<B) -> nPMI in [0,1]
  vectors?: Record<string, number[]>     // skill -> self-trained embedding (cosine relatedness)
}

export type TrainOpts = {
  minCo?: number      // a pair must co-occur in >= this many docs
  minNpmi?: number    // keep only genuinely-associated pairs
  maxNeigh?: number   // cap neighbours per skill (strongest kept)
  isSoft?: (s: string) => boolean // drop mixed soft<->technical edges (broad noise)
  at?: string         // timestamp stamped into the model (caller supplies; keeps this pure)
  sources?: Record<string, number> // provenance counts for transparency
  dims?: number       // if > 0, also train GloVe-style embeddings of this dimensionality
  epochs?: number     // embedding training epochs (default 200)
}

// Deterministic PRNG (mulberry32) so retraining is reproducible without Math.random.
function prng(seed: number) {
  let a = seed >>> 0
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/* Self-trained skill embeddings via the GloVe objective over the co-occurrence
 * counts (AdaGrad). Pure in-house numerics — no external ML lib, trains in ms on the
 * ~80-skill vocab. Same soft/technical filter as the PMI pairs so soft skills don't
 * pollute the vector space. cosine(vec_a, vec_b) gives a dense relatedness that fills
 * gaps the sparse PMI pairs miss. */
function trainVectors(vocab: string[], X: Map<string, number>, dims: number, epochs: number, isSoft: (s: string) => boolean): Record<string, number[]> {
  const idx = new Map(vocab.map((s, i) => [s, i]))
  const V = vocab.length
  const rnd = prng(1234567)
  const mk = () => { const v = new Array(dims); for (let d = 0; d < dims; d++) v[d] = (rnd() - 0.5) / dims; return v }
  const w = vocab.map(mk), wt = vocab.map(mk)
  const b = new Array(V).fill(0), bt = new Array(V).fill(0)
  const gw = vocab.map(() => new Array(dims).fill(1)), gwt = vocab.map(() => new Array(dims).fill(1))
  const gb = new Array(V).fill(1), gbt = new Array(V).fill(1)
  const co: [number, number, number][] = []
  for (const [key, x] of X) {
    const bar = key.indexOf("|"); const a = key.slice(0, bar), bb = key.slice(bar + 1)
    if (isSoft(a) !== isSoft(bb)) continue
    const i = idx.get(a), j = idx.get(bb)
    if (i == null || j == null) continue
    co.push([i, j, x]); co.push([j, i, x]) // symmetric
  }
  const xmax = 100, alpha = 0.75, lr = 0.05
  for (let e = 0; e < epochs; e++) {
    for (const [i, j, x] of co) {
      let dot = b[i] + bt[j]
      for (let d = 0; d < dims; d++) dot += w[i][d] * wt[j][d]
      const diff = dot - Math.log(x)
      const f = x < xmax ? Math.pow(x / xmax, alpha) : 1
      const g = f * diff
      for (let d = 0; d < dims; d++) {
        const gi = g * wt[j][d], gj = g * w[i][d]
        w[i][d] -= (lr * gi) / Math.sqrt(gw[i][d]); wt[j][d] -= (lr * gj) / Math.sqrt(gwt[j][d])
        gw[i][d] += gi * gi; gwt[j][d] += gj * gj
      }
      b[i] -= (lr * g) / Math.sqrt(gb[i]); bt[j] -= (lr * g) / Math.sqrt(gbt[j])
      gb[i] += g * g; gbt[j] += g * g
    }
  }
  const out: Record<string, number[]> = {}
  for (let i = 0; i < V; i++) { const v = new Array(dims); for (let d = 0; d < dims; d++) v[d] = Math.round(((w[i][d] + wt[i][d]) / 2) * 1000) / 1000; out[vocab[i]] = v }
  return out
}

/** Learn nPMI relatedness from skill-sets. Each inner array is the canonical skills
 * present in one document; order/duplicates don't matter. */
export function computeModel(docs: string[][], opts: TrainOpts = {}): TrainedModel {
  const MIN_CO = opts.minCo ?? 4, MIN_NPMI = opts.minNpmi ?? 0.15, MAX_NEIGH = opts.maxNeigh ?? 14
  const isSoft = opts.isSoft || (() => false)

  const docFreq = new Map<string, number>()
  const pairFreq = new Map<string, number>()
  let n = 0
  for (const raw of docs) {
    const set = Array.from(new Set(raw.filter(Boolean))).sort()
    if (set.length < 2) continue
    n++
    for (const a of set) docFreq.set(a, (docFreq.get(a) || 0) + 1)
    for (let i = 0; i < set.length; i++) for (let k = i + 1; k < set.length; k++) {
      const key = set[i] + "|" + set[k]
      pairFreq.set(key, (pairFreq.get(key) || 0) + 1)
    }
  }

  const scored: { key: string; a: string; b: string; npmi: number }[] = []
  for (const [key, f] of pairFreq) {
    if (f < MIN_CO) continue
    const bar = key.indexOf("|")
    const a = key.slice(0, bar), b = key.slice(bar + 1)
    // Soft skills co-occur with almost everything → mixed soft/technical PMI is
    // broad noise. Keep soft<->soft and tech<->tech, which are signal.
    if (isSoft(a) !== isSoft(b)) continue
    const pab = f / n, pa = (docFreq.get(a) as number) / n, pb = (docFreq.get(b) as number) / n
    // nPMI in [-1, 1]. Guard the degenerate pab=1 case (a pair that co-occurs in
    // 100% of qualifying docs): -log(1)=0 would make the ratio 0/0=NaN and silently
    // drop the maximally-correlated pair; its correct nPMI limit is 1.
    const denom = -Math.log(pab)
    const npmi = denom === 0 ? 1 : Math.log(pab / (pa * pb)) / denom
    if (npmi >= MIN_NPMI) scored.push({ key, a, b, npmi: Math.min(1, npmi) })
  }

  // cap neighbours per skill by strength; keep the union
  const per = new Map<string, typeof scored>()
  for (const s of scored) {
    ;(per.get(s.a) || per.set(s.a, []).get(s.a) as typeof scored).push(s)
    ;(per.get(s.b) || per.set(s.b, []).get(s.b) as typeof scored).push(s)
  }
  const keep = new Set<string>()
  for (const list of per.values()) { list.sort((x, y) => y.npmi - x.npmi); for (const s of list.slice(0, MAX_NEIGH)) keep.add(s.key) }

  const pairs: Record<string, number> = {}
  for (const s of scored) if (keep.has(s.key)) pairs[s.key] = Math.round(s.npmi * 1000) / 1000

  let vectors: Record<string, number[]> | undefined
  if (opts.dims && opts.dims > 0) {
    vectors = trainVectors([...docFreq.keys()], pairFreq, opts.dims, opts.epochs ?? 200, isSoft)
  }

  return {
    trained: { docs: n, skills: docFreq.size, pairs: Object.keys(pairs).length, dims: opts.dims || undefined, sources: opts.sources, at: opts.at || "" },
    pairs, vectors,
  }
}

/** Serialize a trained model to the exact TypeScript that lib/career/semantic-model.ts
 * expects. Kept here so CLI and any other caller emit byte-identical files. */
export function serializeModel(m: TrainedModel): string {
  const pairs = m.pairs
  const sortedKeys = Object.keys(pairs).sort()
  const trained = m.trained
    ? `{ docs: ${m.trained.docs}, skills: ${m.trained.skills}, pairs: ${m.trained.pairs}, dims: ${m.trained.dims || 0}, sources: ${JSON.stringify(m.trained.sources || {})}, at: ${JSON.stringify(m.trained.at)} }`
    : "null"
  // Emit vectors compactly (one skill per line), sorted for stable diffs.
  let vectorsLiteral = "{}"
  if (m.vectors && Object.keys(m.vectors).length) {
    const lines = Object.keys(m.vectors).sort().map((k) => `    ${JSON.stringify(k)}: [${m.vectors![k].join(", ")}],`)
    vectorsLiteral = `{\n${lines.join("\n")}\n  }`
  }
  return `/* AUTO-GENERATED by scripts/train-semantic.mjs — a self-trained skill relatedness
 * model learned from Vrittih's OWN data: live jobs + candidate profiles + courses.
 * \`pairs\` = normalised PMI; \`vectors\` = in-house GloVe-style embeddings (cosine
 * relatedness, powers "related skills"). No external model, no download, no LLM.
 * Do NOT edit by hand — re-run \`npm run train:semantic\` to refresh. Empty maps are
 * valid: the semantic layer falls back to the curated ontology. */
export type SemanticModel = {
  trained: { docs?: number; jobs?: number; skills: number; pairs: number; dims?: number; sources?: Record<string, number>; at: string } | null
  pairs: Record<string, number>
  vectors?: Record<string, number[]>
}

export const MODEL: SemanticModel = {
  trained: ${trained},
  pairs: ${JSON.stringify(pairs, sortedKeys, 2)},
  vectors: ${vectorsLiteral},
}
`
}
