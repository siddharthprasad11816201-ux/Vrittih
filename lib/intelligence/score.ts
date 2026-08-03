/* Organizational Health scoring — in-house, PURE, testable.
 *
 * Turns a raw metric value into a 0..100 health score against an explicit good/bad
 * band, rolls domain metrics into a weighted domain score, and rolls domains into an
 * overall organizational health index. Deterministic and explainable — every score
 * carries the band and the reason it landed where it did.
 */

export type Band = "Healthy" | "Watch" | "At risk" | "Critical"

export function band(score: number): Band {
  return score >= 75 ? "Healthy" : score >= 55 ? "Watch" : score >= 35 ? "At risk" : "Critical"
}

export interface MetricSpec {
  key: string
  label: string
  value: number | null      // null = not enough data
  unit?: string             // "%", "days", "count", "CHF"
  good: number              // value at/への which scores ~100
  bad: number               // value at/beyond which scores ~0
  higherIsBetter?: boolean  // default true; set false for "time to hire" etc.
  weight?: number           // relative weight within its domain (default 1)
  hint?: string             // short human note about what this means
}

export interface ScoredMetric extends MetricSpec {
  score: number | null      // 0..100, null if value is null
  band: Band | null
}

/* Linear normalization between bad→0 and good→100, clamped. Respects direction. */
export function scoreMetric(spec: MetricSpec): ScoredMetric {
  if (spec.value == null || !Number.isFinite(spec.value)) {
    return { ...spec, score: null, band: null }
  }
  const higher = spec.higherIsBetter !== false
  const good = spec.good, bad = spec.bad
  let s: number
  if (good === bad) {
    s = spec.value >= good ? 100 : 0
  } else if (higher) {
    s = ((spec.value - bad) / (good - bad)) * 100
  } else {
    // lower is better: good < bad
    s = ((bad - spec.value) / (bad - good)) * 100
  }
  s = Math.max(0, Math.min(100, s))
  const rounded = Math.round(s)
  return { ...spec, score: rounded, band: band(rounded) }
}

export interface DomainHealth {
  domain: string
  label: string
  score: number | null      // weighted mean of scored metrics (null if none scorable)
  band: Band | null
  metrics: ScoredMetric[]
  measured: number          // how many metrics had data
  total: number
}

/* Roll a domain's metrics into one weighted score (metrics lacking data are skipped
 * so a single missing feed doesn't tank the domain). */
export function scoreDomain(domain: string, label: string, specs: MetricSpec[]): DomainHealth {
  const metrics = specs.map(scoreMetric)
  const scored = metrics.filter(m => m.score != null)
  let score: number | null = null
  if (scored.length) {
    const wsum = scored.reduce((a, m) => a + (m.weight ?? 1), 0)
    score = Math.round(scored.reduce((a, m) => a + (m.score as number) * (m.weight ?? 1), 0) / (wsum || 1))
  }
  return { domain, label, score, band: score == null ? null : band(score), metrics, measured: scored.length, total: specs.length }
}

export interface OrgHealth {
  score: number | null
  band: Band | null
  domains: DomainHealth[]
  coverage: number          // fraction of metrics across all domains that had data
}

/* Weighted overall organizational health from domain scores. Domains without any
 * data are excluded from the index (and lower coverage). */
export function rollupHealth(domains: DomainHealth[], weights?: Record<string, number>): OrgHealth {
  const scored = domains.filter(d => d.score != null)
  let score: number | null = null
  if (scored.length) {
    const wsum = scored.reduce((a, d) => a + (weights?.[d.domain] ?? 1), 0)
    score = Math.round(scored.reduce((a, d) => a + (d.score as number) * (weights?.[d.domain] ?? 1), 0) / (wsum || 1))
  }
  const totalMetrics = domains.reduce((a, d) => a + d.total, 0)
  const measuredMetrics = domains.reduce((a, d) => a + d.measured, 0)
  return {
    score, band: score == null ? null : band(score), domains,
    coverage: totalMetrics ? +(measuredMetrics / totalMetrics).toFixed(2) : 0,
  }
}

export function pct(numer: number, denom: number): number | null {
  if (!denom) return null
  return Math.round((numer / denom) * 1000) / 10
}
