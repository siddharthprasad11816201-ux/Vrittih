/* ICIRE — pluggable Coach "brain". The coach's language understanding is behind a
 * small interface so the DEFAULT stays 100% in-house (rules + trained Naive Bayes +
 * slots + conversational — no libs, no external model, patent-clean), while more
 * powerful brains can be opted into WITHOUT touching the patent-clean core:
 *
 *   COACH_BRAIN unset | "inhouse"   -> in-house NLU (default; keeps ALL rules)
 *   COACH_BRAIN = "selfhost"        -> a locally self-hosted open model (relaxes the
 *                                       "no external model" rule; you run it on your GPU)
 *   COACH_BRAIN = "transformer"     -> your own small transformer (relaxes "no libs";
 *                                       trained on your system) — provider added when built
 *
 * Every non-default brain MUST degrade to the in-house brain on any error/timeout, so
 * the coach never hard-depends on external infrastructure. */
import { parseQuery, conversational, type Intent, type Slots } from "@/lib/career/coach"

export type Understanding =
  | { kind: "conversational"; reply: string; suggestions: string[] }
  | { kind: "intent"; intent: Intent; slots: Slots }

export interface CoachBrain {
  readonly name: string
  understand(message: string): Promise<Understanding>
}

/** The in-house brain: exactly today's behaviour (conversational first, then the
 * rule/NB intent + slot parser). No async work — wrapped in a resolved promise so all
 * brains share one interface. Keeps ALL rules. */
export const inhouseBrain: CoachBrain = {
  name: "inhouse",
  async understand(message: string): Promise<Understanding> {
    const conv = conversational(message)
    if (conv) return { kind: "conversational", reply: conv.reply, suggestions: conv.suggestions }
    const { intent, slots } = parseQuery(message)
    return { kind: "intent", intent, slots }
  },
}

// Registry — additional providers register here. Kept lazy so importing brain.ts never
// pulls provider code (or its env) unless that provider is actually selected.
type Factory = () => CoachBrain
const REGISTRY: Record<string, Factory> = { inhouse: () => inhouseBrain }
export function registerBrain(name: string, factory: Factory) { REGISTRY[name] = factory }

/** Pick the brain from COACH_BRAIN, always defaulting to in-house. Unknown value or a
 * factory that throws -> in-house, so a misconfig can never break the coach. */
export function resolveBrain(): CoachBrain {
  const choice = (process.env.COACH_BRAIN || "inhouse").toLowerCase()
  if (choice === "inhouse") return inhouseBrain
  const factory = REGISTRY[choice]
  if (!factory) return inhouseBrain
  try { return factory() } catch { return inhouseBrain }
}
