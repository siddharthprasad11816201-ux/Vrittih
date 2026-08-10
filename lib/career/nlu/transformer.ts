/* ICIRE — OPTIONAL `transformer` brain: YOUR OWN small model, trained FROM SCRATCH on
 * your data with PyTorch on your machine (ml/train_intent.py) and served locally
 * (ml/serve_intent.py). OFF by default; active only when COACH_BRAIN="transformer".
 *
 * Uses PyTorch (a third-party LIBRARY) but NO external pretrained MODEL — the weights are
 * trained from scratch on lib/career/intentData.ts, so there is no downloaded model.
 *
 * Like the self-host brain, it ONLY classifies intent — slots are extracted in-house
 * (extractSlots), conversational replies + answers stay in-house — so it can never author
 * a user-facing word or fabricate advice. Any failure falls back to the in-house brain. */
import { inhouseBrain, registerBrain, type CoachBrain, type Understanding } from "./brain"
import { conversational, extractSlots, type Intent } from "@/lib/career/coach"

const VALID_INTENTS = new Set<Intent>(["help", "learn", "level", "matches", "resume", "interview", "dna", "path", "progress", "salary"])
const BODY_CAP = 16 * 1024

async function readCapped(res: Response, cap: number): Promise<string | null> {
  const len = Number(res.headers.get("content-length") || 0)
  if (len && len > cap) return null
  const reader = (res.body as any)?.getReader?.()
  if (!reader) { const t = await res.text(); return t.length > cap ? null : t }
  const dec = new TextDecoder()
  let out = "", received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.length
    if (received > cap) { try { await reader.cancel() } catch {} return null }
    out += dec.decode(value, { stream: true })
  }
  return out + dec.decode()
}

/** Pure: read the classifier's {intent, confidence} JSON into a valid intent + its
 * confidence (missing confidence -> 1, i.e. trusted), or null when the intent is invalid. */
export function parseClassification(raw: string): { intent: Intent; confidence: number } | null {
  let o: any
  try { o = JSON.parse(raw) } catch { return null }
  const intent = String(o?.intent || "") as Intent
  if (!VALID_INTENTS.has(intent)) return null
  const confidence = typeof o?.confidence === "number" && Number.isFinite(o.confidence) ? o.confidence : 1
  return { intent, confidence }
}

// Below this softmax confidence, defer to the in-house classifier rather than trust a
// possibly-confidently-wrong prediction (esp. on wordings far from the training set).
function minConfidence(): number {
  const m = Number(process.env.TRANSFORMER_MIN_CONFIDENCE)
  return Number.isFinite(m) && m >= 0 && m <= 1 ? m : 0.5
}

const transformerBrain: CoachBrain = {
  name: "transformer",
  async understand(message: string): Promise<Understanding> {
    // Conversational stays 100% in-house — model never authors words.
    const conv = conversational(message)
    if (conv) return { kind: "conversational", reply: conv.reply, suggestions: conv.suggestions, brain: "inhouse" }

    const url = process.env.TRANSFORMER_URL
    if (!url) return inhouseBrain.understand(message)
    const t = Number(process.env.TRANSFORMER_TIMEOUT_MS)
    const timeoutMs = Number.isFinite(t) && t > 0 ? t : 3000
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.slice(0, 500) }),
        signal: ctrl.signal,
      })
      if (!res.ok) return inhouseBrain.understand(message)
      const text = await readCapped(res, BODY_CAP)
      if (text == null) return inhouseBrain.understand(message)
      const c = parseClassification(text)
      // Invalid, or below the confidence floor -> defer to in-house (never a confident-
      // but-wrong route). Model classifies intent; slots are extracted in-house.
      if (!c || c.confidence < minConfidence()) return inhouseBrain.understand(message)
      return { kind: "intent", intent: c.intent, slots: extractSlots(message), brain: "transformer" }
    } catch {
      return inhouseBrain.understand(message)
    } finally {
      clearTimeout(timer)
    }
  },
}

registerBrain("transformer", () => transformerBrain)
export { transformerBrain }
