/* Predictive Intelligence — in-house forecasting primitives. PURE, testable.
 *
 * No external ML. Deterministic, explainable time-series methods a founder can reason
 * about: ordinary least-squares linear regression with R², moving-average smoothing,
 * and a method-selecting forecaster that extrapolates a short horizon with an honest
 * confidence derived from fit quality + sample size. Every forecast says how it was
 * made and how sure it is.
 */

export interface LinReg { slope: number; intercept: number; r2: number }

/* Ordinary least squares over y indexed by x = 0..n-1. Returns slope/intercept + R². */
export function linreg(y: number[]): LinReg {
  const n = y.length
  if (n < 2) return { slope: 0, intercept: n ? y[0] : 0, r2: 0 }
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  for (let i = 0; i < n; i++) { sx += i; sy += y[i]; sxx += i * i; sxy += i * y[i] }
  const denom = n * sxx - sx * sx
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  // R² = 1 - SSres/SStot
  const mean = sy / n
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < n; i++) {
    const pred = slope * i + intercept
    ssRes += (y[i] - pred) ** 2
    ssTot += (y[i] - mean) ** 2
  }
  const r2 = ssTot === 0 ? (ssRes === 0 ? 1 : 0) : Math.max(0, 1 - ssRes / ssTot)
  return { slope, intercept, r2: +r2.toFixed(4) }
}

/* Simple trailing moving average of the last `window` points. */
export function movingAverage(y: number[], window = 3): number {
  if (!y.length) return 0
  const w = Math.min(window, y.length)
  const slice = y.slice(y.length - w)
  return slice.reduce((a, b) => a + b, 0) / w
}

export function pctChange(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100
  return +(((to - from) / Math.abs(from)) * 100).toFixed(1)
}

export type Trend = "rising" | "flat" | "falling"

export interface Forecast {
  method: "linear" | "moving-average" | "naive"
  predictions: number[]   // next `horizon` values, clamped to >= 0
  trend: Trend
  changePct: number       // projected % change from last observed to end of horizon
  confidence: number      // 0..1 — fit quality tempered by sample size
  slope: number
  r2: number
  basis: string           // human-readable explanation
}

/* Forecast the next `horizon` points of a count/level series (oldest → newest).
 *
 * Method selection (deterministic):
 *  - >= 4 points AND R² >= 0.5      → linear regression (a real trend)
 *  - >= 3 points                    → moving average (level, no clear trend)
 *  - otherwise                      → naive (repeat last value)
 * Confidence blends R² (or MA stability) with a sample-size factor. Predictions are
 * clamped at 0 (counts can't go negative). */
export function forecastSeries(y: number[], horizon = 3): Forecast {
  const clean = (y || []).map(v => (Number.isFinite(v) ? v : 0))
  const n = clean.length
  const last = n ? clean[n - 1] : 0

  if (n < 3) {
    const predictions = Array.from({ length: horizon }, () => Math.max(0, last))
    return { method: "naive", predictions, trend: "flat", changePct: 0, confidence: n ? 0.2 : 0, slope: 0, r2: 0, basis: `Too few data points (${n}) — repeating the last value.` }
  }

  const reg = linreg(clean)
  const sizeFactor = Math.min(1, n / 8) // approaches full confidence around 8 observed periods

  if (n >= 4 && reg.r2 >= 0.5) {
    const predictions = Array.from({ length: horizon }, (_, k) => Math.max(0, +(reg.slope * (n + k) + reg.intercept).toFixed(2)))
    const endVal = predictions[predictions.length - 1]
    const trend: Trend = reg.slope > 0.05 * Math.max(1, Math.abs(reg.intercept)) ? "rising" : reg.slope < -0.05 * Math.max(1, Math.abs(reg.intercept)) ? "falling" : "flat"
    return {
      method: "linear", predictions, trend, changePct: pctChange(last, endVal),
      confidence: +(reg.r2 * sizeFactor).toFixed(2), slope: +reg.slope.toFixed(3), r2: reg.r2,
      basis: `Linear trend over ${n} periods (fit R²=${reg.r2}).`,
    }
  }

  // Moving average — level series. Confidence from inverse coefficient of variation.
  const ma = movingAverage(clean, 3)
  const mean = clean.reduce((a, b) => a + b, 0) / n
  const variance = clean.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  const cv = mean === 0 ? 0 : Math.sqrt(variance) / Math.abs(mean)
  const stability = Math.max(0, 1 - Math.min(1, cv))
  const predictions = Array.from({ length: horizon }, () => Math.max(0, +ma.toFixed(2)))
  return {
    method: "moving-average", predictions, trend: "flat", changePct: pctChange(last, ma),
    confidence: +(stability * sizeFactor).toFixed(2), slope: +reg.slope.toFixed(3), r2: reg.r2,
    basis: `3-period moving average over ${n} periods (no strong trend; stability ${stability.toFixed(2)}).`,
  }
}

/* Bucket event timestamps (ms epoch) into `bins` equal windows of `binMs`, ending at
 * `nowMs`. Returns counts oldest → newest — the input series for forecastSeries. */
export function bucketCounts(timestampsMs: number[], binMs: number, bins: number, nowMs: number): number[] {
  const counts = new Array(bins).fill(0)
  const start = nowMs - bins * binMs
  for (const t of timestampsMs) {
    if (t < start || t > nowMs) continue
    let idx = Math.floor((t - start) / binMs)
    if (idx < 0) idx = 0
    if (idx >= bins) idx = bins - 1
    counts[idx]++
  }
  return counts
}
