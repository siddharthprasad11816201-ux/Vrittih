/**
 * Feed engagement + trust primitives (LinkedIn-class). PURE and deterministic — all of
 * this is validation/parsing logic with no I/O, so it is fully testable.
 */

/* ---------- reactions ---------- */

export const REACTIONS = ["like", "celebrate", "support", "insightful", "curious"] as const
export type Reaction = (typeof REACTIONS)[number]

/** Any unknown reaction degrades to a plain "like" rather than being rejected. */
export function normalizeReaction(v: any): Reaction {
  return (REACTIONS as readonly string[]).includes(v) ? (v as Reaction) : "like"
}

/** Count reactions by type, plus a total. Deterministic key order. */
export function tallyReactions(rows: { reaction?: string | null }[]): { total: number; byType: Record<Reaction, number> } {
  const byType = Object.fromEntries(REACTIONS.map((r) => [r, 0])) as Record<Reaction, number>
  for (const r of rows) byType[normalizeReaction(r.reaction)]++
  return { total: rows.length, byType }
}

/* ---------- hashtags ---------- */

// #tag: letters/digits/underscore, must start with a letter, 2..50 chars.
const TAG_RE = /#([a-zA-Z][a-zA-Z0-9_]{1,49})\b/g

/** Extract unique lowercase hashtags from post text (max 10, order preserved). */
export function parseHashtags(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of String(text || "").matchAll(TAG_RE)) {
    const tag = m[1].toLowerCase()
    if (!seen.has(tag)) { seen.add(tag); out.push(tag) }
    if (out.length >= 10) break
  }
  return out
}

/* ---------- reports ---------- */

export const REPORT_REASONS = ["spam", "harassment", "misinformation", "scam", "other"] as const
export const REPORT_TARGETS = ["post", "comment", "user", "job", "company"] as const
export const REPORT_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const

export function isValidReason(v: any): boolean { return (REPORT_REASONS as readonly string[]).includes(v) }
export function isValidTarget(v: any): boolean { return (REPORT_TARGETS as readonly string[]).includes(v) }
export function isValidStatus(v: any): boolean { return (REPORT_STATUSES as readonly string[]).includes(v) }

/* ---------- blocking ---------- */

/**
 * Blocking is MUTUAL for visibility: if either side blocked the other, neither sees the
 * other's content. Returns the set of user ids to hide from `viewerId`.
 */
export function hiddenUserIds(blocks: { blockerId: string; blockedId: string }[], viewerId: string): Set<string> {
  const hidden = new Set<string>()
  for (const b of blocks) {
    if (b.blockerId === viewerId) hidden.add(b.blockedId)
    else if (b.blockedId === viewerId) hidden.add(b.blockerId)
  }
  return hidden
}

/* ---------- endorsements ---------- */

/**
 * Endorsement credibility, 0..1 with diminishing returns — 1 endorsement is meaningful,
 * the 20th adds almost nothing. Never a linear count, so it cannot be gamed by volume.
 *
 * Hard-capped BELOW 1: peer endorsements are social proof, not proof. No amount of
 * volume should ever express total certainty (same honesty discipline as the capped
 * skill-transfer credit in lib/career/semantic).
 */
const ENDORSEMENT_CAP = 0.95
export function endorsementWeight(count: number): number {
  const n = Math.max(0, Math.floor(count))
  if (n === 0) return 0
  return +Math.min(ENDORSEMENT_CAP, 1 - Math.pow(0.75, n)).toFixed(3)
}
