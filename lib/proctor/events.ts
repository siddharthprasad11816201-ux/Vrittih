/* Semantic Proctoring — event taxonomy, severity & risk aggregation. PURE, testable.
 *
 * EROS Module 6/7, Phase 1. This engine classifies OBSERVABLE integrity events and
 * aggregates them into an explainable session risk score. It makes NO character
 * judgment: a high risk score routes a session to HUMAN review, it never determines
 * guilt. No emotion/personality inference, no raw media — metadata only. Deterministic
 * and auditable end to end.
 */

export type Severity = "info" | "low" | "medium" | "high"
const SEV_WEIGHT: Record<Severity, number> = { info: 0, low: 3, medium: 8, high: 18 }

export interface EventTypeDef {
  type: string
  label: string
  category: "presence" | "environment" | "device" | "screen" | "input" | "network" | "audio"
  severity: Severity
  policyRef: string
  /* on-device/browser only; Phase 2 (vision) types are declared but not emitted in P1 */
  phase: 1 | 2
}

/* The canonical Phase-1 event taxonomy (browser/device/network signals — no camera CV;
 * face/object types are declared for Phase 2 so the schema/UI are forward-compatible). */
export const EVENT_TYPES: EventTypeDef[] = [
  // screen / focus (Phase 1 — real browser signals)
  { type: "window.blur", label: "Left the interview window", category: "screen", severity: "medium", policyRef: "focus.stay-on-task", phase: 1 },
  { type: "window.focus", label: "Returned to the window", category: "screen", severity: "info", policyRef: "focus.stay-on-task", phase: 1 },
  { type: "tab.hidden", label: "Switched tab / minimised", category: "screen", severity: "medium", policyRef: "focus.stay-on-task", phase: 1 },
  { type: "tab.visible", label: "Tab visible again", category: "screen", severity: "info", policyRef: "focus.stay-on-task", phase: 1 },
  { type: "fullscreen.exit", label: "Exited fullscreen", category: "screen", severity: "low", policyRef: "focus.fullscreen", phase: 1 },
  { type: "clipboard.paste", label: "Pasted from clipboard", category: "input", severity: "high", policyRef: "integrity.no-paste", phase: 1 },
  { type: "clipboard.copy", label: "Copied to clipboard", category: "input", severity: "low", policyRef: "integrity.no-copy", phase: 1 },
  { type: "devtools.open", label: "Developer tools opened", category: "screen", severity: "high", policyRef: "integrity.no-devtools", phase: 1 },
  { type: "screens.multiple", label: "Multiple displays detected", category: "device", severity: "medium", policyRef: "environment.single-screen", phase: 1 },
  { type: "idle", label: "No activity for a sustained period", category: "input", severity: "low", policyRef: "presence.active", phase: 1 },
  // device / network (Phase 1)
  { type: "camera.unavailable", label: "Camera not available", category: "device", severity: "medium", policyRef: "presence.camera", phase: 1 },
  { type: "camera.granted", label: "Camera permitted", category: "device", severity: "info", policyRef: "presence.camera", phase: 1 },
  { type: "mic.unavailable", label: "Microphone not available", category: "device", severity: "low", policyRef: "presence.mic", phase: 1 },
  { type: "device.changed", label: "Media device changed mid-session", category: "device", severity: "medium", policyRef: "environment.stable-devices", phase: 1 },
  { type: "network.offline", label: "Network dropped", category: "network", severity: "low", policyRef: "environment.connectivity", phase: 1 },
  { type: "network.online", label: "Network restored", category: "network", severity: "info", policyRef: "environment.connectivity", phase: 1 },
  // Phase 2 (on-device CV / audio — declared, NOT emitted in Phase 1)
  { type: "face.absent", label: "Face not visible", category: "presence", severity: "medium", policyRef: "presence.face", phase: 2 },
  { type: "face.multiple", label: "More than one person visible", category: "presence", severity: "high", policyRef: "presence.single-person", phase: 2 },
  { type: "object.phone", label: "Phone-like object visible", category: "environment", severity: "high", policyRef: "environment.no-devices", phase: 2 },
  { type: "audio.multiple-voices", label: "More than one voice", category: "audio", severity: "medium", policyRef: "presence.single-person", phase: 2 },
]

const BY_TYPE: Record<string, EventTypeDef> = Object.fromEntries(EVENT_TYPES.map(e => [e.type, e]))

const UNKNOWN: EventTypeDef = { type: "unknown", label: "Unrecognised event", category: "screen", severity: "info", policyRef: "n/a", phase: 1 }

export function classify(type: string): EventTypeDef { return BY_TYPE[type] || { ...UNKNOWN, type } }
/* Trust-boundary guard: only catalogued event types are accepted for storage. */
export function isKnownType(type: string): boolean { return !!BY_TYPE[type] }

export const RISK_BAND = (score: number) => score >= 60 ? "high" : score >= 30 ? "elevated" : score >= 10 ? "low" : "clear"

export interface RiskContributor { type: string; label: string; count: number; severity: Severity; points: number }
export interface RiskResult {
  score: number                 // 0..100, deterministic
  band: "clear" | "low" | "elevated" | "high"
  contributors: RiskContributor[]
  eventCount: number
  note: string
}

/* Aggregate a session's events into an explainable 0..100 risk score.
 *
 * Deterministic model: each event contributes its severity weight, but repeats of the
 * same type get DIMINISHING returns (sqrt of count) so one noisy signal can't dominate;
 * a small diversity bonus reflects that several independent signals matter more than
 * many of one. Confidence scales each event's contribution. Bounded to 100. This is a
 * TRIAGE score for routing to humans — never a verdict. */
export function sessionRisk(events: { type: string; confidence?: number }[]): RiskResult {
  const groups = new Map<string, { count: number; conf: number; def: EventTypeDef }>()
  for (const e of events) {
    const def = classify(e.type)
    if (def.severity === "info") continue            // info events never add risk
    const g = groups.get(def.type) || { count: 0, conf: 0, def }
    g.count++; g.conf += (typeof e.confidence === "number" ? Math.max(0, Math.min(1, e.confidence)) : 1)
    groups.set(def.type, g)
  }
  const contributors: RiskContributor[] = []
  let raw = 0
  for (const [type, g] of groups) {
    const avgConf = g.conf / g.count
    // diminishing returns on repeats (sqrt), then a HARD per-type cap (2.5× base weight)
    // so no single noisy/duplicated signal type can alone push the score into "high".
    const w = SEV_WEIGHT[g.def.severity]
    const points = Math.min(w * 2.5, w * Math.sqrt(g.count) * avgConf)
    raw += points
    contributors.push({ type, label: g.def.label, count: g.count, severity: g.def.severity, points: +points.toFixed(1) })
  }
  // small diversity bonus (distinct risky types), capped
  raw += Math.min(10, Math.max(0, groups.size - 1) * 2)
  const score = Math.round(Math.max(0, Math.min(100, raw)))
  contributors.sort((a, b) => b.points - a.points)
  const band = RISK_BAND(score)
  const note = score === 0
    ? "No integrity signals recorded."
    : `Triage score from ${events.length} event(s) across ${groups.size} signal type(s) — routes to human review, not a verdict.`
  return { score, band, contributors, eventCount: events.length, note }
}

/* Which review status a session should DEFAULT to (a human can always override). */
export function suggestedReview(score: number): "PENDING" | "CLEARED" {
  return score >= 10 ? "PENDING" : "CLEARED"
}
