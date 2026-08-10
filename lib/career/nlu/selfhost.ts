/* ICIRE — OPTIONAL self-hosted-model brain for the coach. OFF by default; active only
 * when COACH_BRAIN="selfhost". Talks to a LOCAL, self-hosted, OpenAI-compatible chat
 * endpoint you run on your own GPU (e.g. llama.cpp server, Ollama, vLLM) — nothing
 * leaves your machine, no SaaS LLM.
 *
 * IMPORTANT honesty guardrail: the model is used ONLY to understand the message
 * (classify intent + extract slots, or produce a short conversational line). It NEVER
 * generates the career answer — those still come from the in-house, evidence-based
 * handlers on real profile + job data. So enabling this relaxes the "no external
 * model" rule for UNDERSTANDING only; it can never fabricate advice.
 *
 * Any failure (no endpoint, timeout, bad JSON, invalid intent) degrades silently to
 * the in-house brain, so the coach never hard-depends on the model being up. */
import { inhouseBrain, registerBrain, type CoachBrain, type Understanding } from "./brain"
import type { Intent, Slots } from "@/lib/career/coach"

const VALID_INTENTS = new Set<Intent>(["help", "learn", "level", "matches", "resume", "interview", "dna", "path", "progress", "salary"])

const SYSTEM = `You classify a career-app user's message. Respond with STRICT JSON only, no prose.
Schema: {"kind":"intent"|"conversational","intent":<one of: help,learn,level,matches,resume,interview,dna,path,progress,salary>,"slots":{"threshold":<0-100 or null>,"remote":<true|false>,"type":<"internship" or null>},"reply":<short friendly line, only when kind is conversational>}
Rules: pick the single best intent; "threshold" is a match-percentage the user asked for (e.g. "more than 50%" -> 50); set kind="conversational" only for greetings/thanks/smalltalk/unclear. Output JSON, nothing else.`

/** Pure: validate + coerce a model's JSON string into an Understanding, or null if it
 * isn't usable (caller then falls back to in-house). Unit-tested without a network. */
export function parseBrainJSON(raw: string): Understanding | null {
  if (!raw) return null
  const m = raw.match(/\{[\s\S]*\}/) // tolerate code fences / stray text around the JSON
  if (!m) return null
  let o: any
  try { o = JSON.parse(m[0]) } catch { return null }
  if (o && o.kind === "conversational" && typeof o.reply === "string" && o.reply.trim()) {
    return { kind: "conversational", reply: o.reply.trim().slice(0, 500), suggestions: ["What are my best-fit jobs?", "What should I learn next?"] }
  }
  const intent = String(o?.intent || "") as Intent
  if (!VALID_INTENTS.has(intent)) return null
  const s = o?.slots || {}
  const slots: Slots = {}
  const n = Number(s.threshold)
  if (Number.isFinite(n) && n >= 0 && n <= 100) slots.threshold = Math.round(n)
  if (s.remote === true) slots.remote = true
  if (typeof s.type === "string" && /intern/i.test(s.type)) slots.type = "internship"
  return { kind: "intent", intent, slots }
}

const selfhostBrain: CoachBrain = {
  name: "selfhost",
  async understand(message: string): Promise<Understanding> {
    const url = process.env.COACH_LLM_URL
    if (!url) return inhouseBrain.understand(message)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), Number(process.env.COACH_LLM_TIMEOUT_MS) || 4000)
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
      const data = await res.json().catch(() => null)
      const content = data?.choices?.[0]?.message?.content
      const parsed = typeof content === "string" ? parseBrainJSON(content) : null
      return parsed || inhouseBrain.understand(message)
    } catch {
      return inhouseBrain.understand(message) // no endpoint / timeout / bad response
    } finally {
      clearTimeout(timer)
    }
  },
}

registerBrain("selfhost", () => selfhostBrain)
export { selfhostBrain }
