/* ICIRE — in-house learned intent classifier for the coach. A multinomial Naive
 * Bayes model (unigrams + bigrams, add-1 smoothing) TRAINED from lib/career/intentData
 * on this system — no external NLP lib, no LLM. Deterministic and explainable. Used
 * by classifyIntent as the fallback when the high-precision rules don't fire, so the
 * coach understands paraphrases it was never hand-coded for, and improves as more
 * labeled phrasings are added to the training set. */
import { TRAINING } from "./intentData"
import type { Intent } from "./coach"

const norm = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
function features(text: string): string[] {
  const toks = norm(text).split(/[^a-z0-9]+/).filter(Boolean)
  const f = [...toks]
  for (let i = 0; i < toks.length - 1; i++) f.push(toks[i] + "_" + toks[i + 1]) // bigrams
  return f
}

// --- train once at module load (tiny; instant) ---
type Model = { classes: Intent[]; logPrior: Map<Intent, number>; logLik: Map<Intent, Map<string, number>>; vocab: number; totals: Map<Intent, number>; counts: Map<Intent, Map<string, number>> }
const MODEL: Model = (() => {
  const classes = Array.from(new Set(TRAINING.map((d) => d.intent))) as Intent[]
  const counts = new Map<Intent, Map<string, number>>()
  const totals = new Map<Intent, number>()
  const docCount = new Map<Intent, number>()
  const vocabSet = new Set<string>()
  for (const c of classes) { counts.set(c, new Map()); totals.set(c, 0); docCount.set(c, 0) }
  for (const d of TRAINING) {
    docCount.set(d.intent, (docCount.get(d.intent) || 0) + 1)
    const cm = counts.get(d.intent) as Map<string, number>
    for (const f of features(d.text)) { cm.set(f, (cm.get(f) || 0) + 1); totals.set(d.intent, (totals.get(d.intent) as number) + 1); vocabSet.add(f) }
  }
  const N = TRAINING.length
  const logPrior = new Map<Intent, number>()
  for (const c of classes) logPrior.set(c, Math.log((docCount.get(c) as number) / N))
  const vocab = vocabSet.size
  const logLik = new Map<Intent, Map<string, number>>()
  for (const c of classes) {
    const cm = counts.get(c) as Map<string, number>, tot = totals.get(c) as number, m = new Map<string, number>()
    for (const [f, n] of cm) m.set(f, Math.log((n + 1) / (tot + vocab)))
    logLik.set(c, m)
  }
  return { classes, logPrior, logLik, vocab, totals, counts }
})()

export type LearnedIntent = { intent: Intent; confident: boolean; margin: number }

/** Classify with the trained NB model. `confident` is false when the top two classes
 * are too close (or nothing is recognised), so the caller can fall back to help. */
export function classifyLearned(text: string): LearnedIntent {
  const feats = features(text)
  const scored: { c: Intent; s: number }[] = []
  for (const c of MODEL.classes) {
    let s = MODEL.logPrior.get(c) as number
    const ll = MODEL.logLik.get(c) as Map<string, number>
    const tot = MODEL.totals.get(c) as number
    const unseen = Math.log(1 / (tot + MODEL.vocab)) // add-1 for out-of-vocab
    for (const f of feats) s += ll.get(f) ?? unseen
    scored.push({ c, s })
  }
  scored.sort((a, b) => b.s - a.s)
  const top = scored[0], second = scored[1]
  const margin = top && second ? top.s - second.s : Infinity
  // Require a recognised feature AND a clear margin to be "confident".
  const anyKnown = feats.some((f) => MODEL.classes.some((c) => (MODEL.logLik.get(c) as Map<string, number>).has(f)))
  return { intent: top.c, confident: anyKnown && margin >= 1.0, margin: Math.round(margin * 100) / 100 }
}
