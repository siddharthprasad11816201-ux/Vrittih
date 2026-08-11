/**
 * Coach conversational memory — PURE carry-over rules.
 *
 * The coach is deterministic (no LLM state), so "memory" means: when the new message is a
 * FOLLOW-UP that does not restate the topic, inherit the previous turn's intent and merge
 * its filters. Nothing is guessed — a message that clearly states its own intent always
 * wins, and inheritance is capped so a stale topic cannot haunt the conversation.
 */
import type { Intent, Slots } from "./coach"

/** How long a prior turn stays eligible for inheritance. */
export const MEMORY_TTL_MINUTES = 30

/** Phrases that signal a refinement of the previous answer rather than a new topic. */
const FOLLOWUP_RE = /^(?:\s*(?:and|but|ok(?:ay)?|also|then|what about|how about|any|only|just|show|give)\b|\s*(?:what|how) about\b)/i
const PRONOUN_REF_RE = /\b(?:those|these|them|that one|the second|the first|the last|it|the same)\b/i

export interface PriorTurn {
  intent?: Intent | null
  slots?: Slots | null
  createdAt: Date | string
}

/** Is `text` a follow-up that should inherit context? */
export function isFollowUp(text: string, ownIntentIsGeneric: boolean): boolean {
  const t = (text || "").trim()
  if (!t) return false
  // Short refinements ("remote only", "in Zurich") are follow-ups when they carry no
  // topic of their own.
  const short = t.split(/\s+/).length <= 6
  return FOLLOWUP_RE.test(t) || PRONOUN_REF_RE.test(t) || (short && ownIntentIsGeneric)
}

/** Is the prior turn still fresh enough to inherit from? */
export function isFresh(prior: PriorTurn | null | undefined, now: Date): boolean {
  if (!prior?.createdAt) return false
  const mins = (now.getTime() - new Date(prior.createdAt).getTime()) / 60000
  return mins >= 0 && mins <= MEMORY_TTL_MINUTES
}

export interface Resolved { intent: Intent; slots: Slots; inherited: boolean }

/**
 * Merge the current turn with the prior one.
 *  - The current message's OWN slots always win over inherited ones.
 *  - The prior intent is inherited only for a fresh follow-up whose own intent is generic
 *    ("help"/"fallback"), so a clearly-stated new topic is never overridden.
 */
export function resolveTurn(
  current: { intent: Intent; slots: Slots; text: string },
  prior: PriorTurn | null | undefined,
  now: Date,
): Resolved {
  const genericIntent = current.intent === "help" || current.intent === "fallback"
  const eligible = isFresh(prior, now) && isFollowUp(current.text, genericIntent)
  if (!eligible || !prior) return { intent: current.intent, slots: current.slots, inherited: false }

  const priorSlots = prior.slots || {}
  // Current slots take precedence; prior slots fill the gaps.
  const slots: Slots = { ...priorSlots, ...current.slots }
  const intent = genericIntent && prior.intent ? (prior.intent as Intent) : current.intent
  const inherited = intent !== current.intent || Object.keys(priorSlots).some((k) => !(k in current.slots))
  return { intent, slots, inherited }
}
