/* OPTIONAL generative narration for the coach. OFF by default (COACH_NARRATE=on).
 * A local self-hosted model (COACH_LLM_URL — e.g. Ollama running Mistral) rewrites the
 * coach's IN-HOUSE draft answer in a warmer, more conversational voice. It is GROUNDED:
 * the draft is already composed from real data, and a hard guardrail rejects any rewrite
 * that introduces a number / percentage / currency not present in the draft — so the
 * model can rephrase, but can NEVER add, change, or fabricate a fact. Any failure (no
 * endpoint, timeout, oversized body, guardrail violation) returns the original draft
 * unchanged, so answers are never worse than the in-house version. */

const BODY_CAP = 32 * 1024

const SYSTEM = `You rephrase a career assistant's reply in a warm, natural, encouraging voice.
STRICT RULES: do not add, remove, or change ANY fact, number, percentage, skill name, job
title, company, or currency. Keep every figure exactly as given. Same meaning, friendlier
tone, similar length. Output ONLY the rephrased text, no preamble.`

// digit runs (commas stripped) — the set of numbers the draft is allowed to contain
function numbers(s: string): Set<string> {
  return new Set((s.replace(/,/g, "").match(/\d+/g) || []))
}
/** The rewrite may only use numbers already in the draft, and must not introduce a
 * non-CHF currency symbol the draft didn't have. */
export function isGrounded(draft: string, out: string): boolean {
  const allowed = numbers(draft)
  for (const n of numbers(out)) if (!allowed.has(n)) return false
  for (const sym of ["₹", "₨", "$", "€", "£"]) if (out.includes(sym) && !draft.includes(sym)) return false
  if (/\bINR\b|\bUSD\b|\bLPA\b/i.test(out) && !/\bINR\b|\bUSD\b|\bLPA\b/i.test(draft)) return false
  return true
}

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

/** Rephrase `draft` via the local model, grounded; returns `draft` unchanged on anything
 * short of a clean, grounded rewrite. */
export async function narrate(draft: string): Promise<string> {
  if (process.env.COACH_NARRATE !== "on") return draft
  const url = process.env.COACH_LLM_URL
  if (!url || !draft || draft.length < 20) return draft
  const t = Number(process.env.COACH_NARRATE_TIMEOUT_MS)
  const timeoutMs = Number.isFinite(t) && t > 0 ? t : 6000
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.COACH_LLM_KEY ? { Authorization: `Bearer ${process.env.COACH_LLM_KEY}` } : {}) },
      body: JSON.stringify({
        model: process.env.COACH_LLM_MODEL || "local",
        temperature: 0.3,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: draft.slice(0, 2000) }],
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) return draft
    const text = await readCapped(res, BODY_CAP)
    if (text == null) return draft
    let data: any = null
    try { data = JSON.parse(text) } catch { return draft }
    const out = data?.choices?.[0]?.message?.content
    if (typeof out !== "string" || !out.trim()) return draft
    const cleaned = out.trim().slice(0, draft.length + 400)
    return isGrounded(draft, cleaned) ? cleaned : draft // guardrail: never let it invent facts
  } catch {
    return draft
  } finally {
    clearTimeout(timer)
  }
}
