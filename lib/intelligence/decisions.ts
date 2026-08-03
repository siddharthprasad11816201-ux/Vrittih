/* Decision Engine — in-house decision support. PURE, testable.
 *
 * Turns health scores + forecasts + raw metrics into ranked DecisionCards. Every card
 * explains itself: evidence, supporting metrics, confidence, alternatives, risks — the
 * spec's non-negotiable. Rules are deterministic functions; generic rules here operate
 * on any DomainHealth/Forecast, domain-specific rules (hiring demand, skill shortage,
 * retention risk…) are registered by the API layer once real metrics are extracted.
 *
 * Reuses the platform's cognitive vocabulary in spirit (evidence + confidence), and can
 * be handed to lib/aios/recommend.rank for cross-card ordering when desired.
 */
import type { DomainHealth } from "@/lib/intelligence/score"
import type { Forecast } from "@/lib/intelligence/forecast"

export type Severity = "critical" | "high" | "medium" | "low" | "opportunity"

const SEV_RANK: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, opportunity: 1 }

export interface DecisionCard {
  id: string
  domain: string
  title: string
  severity: Severity
  recommendation: string
  evidence: string[]
  supportingMetrics: { label: string; value: string; band?: string | null }[]
  confidence: number          // 0..1
  alternatives: string[]
  risks: string[]
}

export interface DecisionContext {
  domains: DomainHealth[]
  forecasts: Record<string, Forecast>   // keyed by "domain.metricKey" or metric key
  now?: number
}

export type DecisionRule = (ctx: DecisionContext) => DecisionCard[]

/* ---- generic, data-agnostic rules ---- */

/* Any domain in a poor band becomes a card, evidenced by its weakest measured metrics. */
export const domainHealthRule: DecisionRule = (ctx) => {
  const cards: DecisionCard[] = []
  for (const d of ctx.domains) {
    if (d.score == null) continue
    if (d.band === "Healthy" || d.band === "Watch") continue
    const weak = d.metrics.filter(m => m.score != null).sort((a, b) => (a.score as number) - (b.score as number)).slice(0, 3)
    const severity: Severity = d.band === "Critical" ? "critical" : "high"
    cards.push({
      id: `health:${d.domain}`,
      domain: d.domain,
      title: `${d.label} health is ${d.band?.toLowerCase()}`,
      severity,
      recommendation: `Prioritise ${d.label.toLowerCase()}: ${weak.map(m => m.label.toLowerCase()).join(", ") || "review the domain"} ${weak.length > 1 ? "are" : "is"} dragging the score to ${d.score}/100.`,
      evidence: weak.map(m => `${m.label}: ${fmt(m.value, m.unit)} (${m.band})${m.hint ? " — " + m.hint : ""}`),
      supportingMetrics: weak.map(m => ({ label: m.label, value: fmt(m.value, m.unit), band: m.band })),
      confidence: +Math.min(0.95, 0.5 + (d.measured / Math.max(1, d.total)) * 0.45).toFixed(2),
      alternatives: [
        `Set a 30-day target to move ${d.label} into the Watch band (55+).`,
        `Reallocate attention from a Healthy domain to ${d.label} this cycle.`,
      ],
      risks: d.band === "Critical"
        ? [`Left unaddressed, ${d.label.toLowerCase()} will compound into adjacent domains.`]
        : [`Metric coverage is ${Math.round((d.measured / Math.max(1, d.total)) * 100)}% — confirm the read before acting.`],
    })
  }
  return cards
}

/* Any forecast trending down with reasonable confidence becomes an early-warning card. */
export const negativeTrendRule: DecisionRule = (ctx) => {
  const cards: DecisionCard[] = []
  for (const [key, f] of Object.entries(ctx.forecasts || {})) {
    if (f.trend !== "falling" || f.confidence < 0.4) continue
    const [domain, metric] = key.includes(".") ? key.split(".") : ["operational", key]
    cards.push({
      id: `trend:${key}`,
      domain,
      title: `${humanize(metric)} is trending down`,
      severity: f.confidence >= 0.7 ? "high" : "medium",
      recommendation: `${humanize(metric)} is projected to change ${f.changePct}% over the next ${f.predictions.length} periods — investigate the cause now, before it shows up in outcomes.`,
      evidence: [f.basis, `Projected next values: ${f.predictions.join(", ")}.`],
      supportingMetrics: [{ label: humanize(metric), value: `${f.changePct}% projected`, band: null }],
      confidence: f.confidence,
      alternatives: [`Treat as noise and re-check next period.`, `Commission a deeper drill-down on ${humanize(metric).toLowerCase()}.`],
      risks: [`Forecast confidence is ${Math.round(f.confidence * 100)}% — a short series can mislead.`],
    })
  }
  return cards
}

/* Strong upward forecasts surface as growth opportunities. */
export const growthOpportunityRule: DecisionRule = (ctx) => {
  const cards: DecisionCard[] = []
  for (const [key, f] of Object.entries(ctx.forecasts || {})) {
    if (f.trend !== "rising" || f.confidence < 0.55) continue
    const [domain, metric] = key.includes(".") ? key.split(".") : ["operational", key]
    cards.push({
      id: `growth:${key}`,
      domain,
      title: `${humanize(metric)} is accelerating`,
      severity: "opportunity",
      recommendation: `${humanize(metric)} is projected to rise ${f.changePct}% — resource ahead of the curve to capture it.`,
      evidence: [f.basis, `Projected next values: ${f.predictions.join(", ")}.`],
      supportingMetrics: [{ label: humanize(metric), value: `+${f.changePct}% projected`, band: null }],
      confidence: f.confidence,
      alternatives: [`Hold capacity steady and absorb the growth.`, `Pilot a small expansion before committing.`],
      risks: [`Over-investing on a ${Math.round(f.confidence * 100)}%-confidence forecast wastes budget if it reverts.`],
    })
  }
  return cards
}

export const GENERIC_RULES: DecisionRule[] = [domainHealthRule, negativeTrendRule, growthOpportunityRule]

/* Run rules, dedupe by id, rank by severity then confidence. */
export function runDecisions(ctx: DecisionContext, rules: DecisionRule[] = GENERIC_RULES): DecisionCard[] {
  const seen = new Map<string, DecisionCard>()
  for (const rule of rules) {
    let cards: DecisionCard[] = []
    try { cards = rule(ctx) || [] } catch { cards = [] }
    for (const c of cards) if (!seen.has(c.id)) seen.set(c.id, c)
  }
  return Array.from(seen.values()).sort((a, b) =>
    SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.confidence - a.confidence)
}

/* ---- helpers ---- */
function fmt(v: number | null, unit?: string): string {
  if (v == null) return "—"
  if (unit === "%") return `${v}%`
  if (unit === "days") return `${v}d`
  if (unit === "CHF") return `CHF ${v.toLocaleString()}`
  return String(v)
}
function humanize(s: string): string {
  return s.replace(/[._-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, c => c.toUpperCase())
}
