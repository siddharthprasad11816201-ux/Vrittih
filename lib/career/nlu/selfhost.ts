/* ICIRE — OPTIONAL self-hosted-model brain for the coach. OFF by default; active only
 * when COACH_BRAIN="selfhost". Talks to a LOCAL, self-hosted, OpenAI-compatible chat
 * endpoint you run on your own GPU (llama.cpp server, Ollama, vLLM) — nothing leaves
 * your machine, no SaaS LLM.
 *
 * HARD honesty guarantee (enforced by code, not by prompt cooperation): the model is
 * used ONLY to classify intent + extract slots. It NEVER authors a single user-facing
 * word — conversational replies come from the in-house canned set, and career answers
 * come from the in-house, evidence-based handlers on real data. So a garbage / quantized
 * / adversarial local model can at worst pick a wrong intent (bounded, safe); it can
 * never fabricate advice or a salary.
 *
 * Any failure (no endpoint, timeout, non-OK, oversized body, bad/absent JSON, invalid
 * intent) degrades silently to the in-house brain. */
import { inhouseBrain, registerBrain, type CoachBrain, type Understanding } from "./brain"
import { conversational, type Intent, type Slots } from "@/lib/career/coach"

const VALID_INTENTS = new Set<Intent>(["help", "learn", "level", "matches", "resume", "interview", "dna", "path", "progress", "salary"])
const BODY_CAP = 64 * 1024 // bytes — a compromised local server must not be able to OOM us

const SYSTEM = `You classify a career-app user's message. Respond with STRICT JSON only, no prose.
Schema: {"intent":<one of: help,learn,level,matches,resume,interview,dna,path,progress,salary>,"slots":{"threshold":<integer 0-100 or null>,"remote":<true|false>,"type":<"internship" or null>}}
Pick the single best intent. "threshold" is a match-percentage the user asked for (e.g. "more than 50%" -> 50), otherwise null. Output the JSON object and nothing else.`

// Find a parseable JSON object in the model's content: try the whole string, else the
// first BALANCED {...} (a greedy /\{[\s\S]*\}/ would swallow trailing prose and fail
// whenever surrounding text contains a brace).
function extractJSON(raw: string): any | null {
  if (!raw) return null
  try { return JSON.parse(raw) } catch {}
  const start = raw.indexOf("{")
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === "{") depth++
    else if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(raw.slice(start, i + 1)) } catch { return null } } }
  }
  return null
}

/** Pure: validate a model's content into an intent Understanding, or null (caller falls
 * back to in-house). Intent-only by design — the model never produces user-facing text. */
export function parseBrainJSON(raw: string): { kind: "intent"; intent: Intent; slots: Slots } | null {
  const o = extractJSON(raw)
  if (!o) return null
  const intent = String(o.intent || "") as Intent
  if (!VALID_INTENTS.has(intent)) return null
  const s = o.slots || {}
  const slots: Slots = {}
  // Only a real number is a threshold — Number(null)===0 would otherwise inject a
  // spurious 0% (the schema's documented "threshold: null" is the happy path).
  if (typeof s.threshold === "number" && Number.isFinite(s.threshold) && s.threshold >= 0 && s.threshold <= 100) slots.threshold = Math.round(s.threshold)
  if (s.remote === true) slots.remote = true
  if (typeof s.type === "string" && /intern/i.test(s.type)) slots.type = "internship"
  return { kind: "intent", intent, slots }
}

// Read a response body with a hard byte cap (the timeout bounds elapsed time, not bytes).
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

const selfhostBrain: CoachBrain = {
  name: "selfhost",
  async understand(message: string): Promise<Understanding> {
    // Conversational handling is 100% in-house (canned strings) — resolved before the
    // model is ever consulted, so the model can't author user-facing words.
    const conv = conversational(message)
    if (conv) return { kind: "conversational", reply: conv.reply, suggestions: conv.suggestions, brain: "inhouse" }

    const url = process.env.COACH_LLM_URL
    if (!url) return inhouseBrain.understand(message)
    const t = Number(process.env.COACH_LLM_TIMEOUT_MS)
    const timeoutMs = Number.isFinite(t) && t > 0 ? t : 4000
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.COACH_LLM_KEY ? { Authorization: `Bearer ${process.env.COACH_LLM_KEY}` } : {}) },
        body: JSON.stringify({
          model: process.env.COACH_LLM_MODEL || "local",
          temperature: 0,
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: message.slice(0, 500) }],
        }),
        signal: ctrl.signal,
      })
      if (!res.ok) return inhouseBrain.understand(message)
      const text = await readCapped(res, BODY_CAP)
      if (text == null) return inhouseBrain.understand(message)
      let data: any = null
      try { data = JSON.parse(text) } catch { return inhouseBrain.understand(message) }
      const content = data?.choices?.[0]?.message?.content
      const parsed = typeof content === "string" ? parseBrainJSON(content) : null
      return parsed ? { ...parsed, brain: "selfhost" } : inhouseBrain.understand(message)
    } catch {
      return inhouseBrain.understand(message) // no endpoint / timeout / bad response
    } finally {
      clearTimeout(timer)
    }
  },
}

registerBrain("selfhost", () => selfhostBrain)
export { selfhostBrain }
