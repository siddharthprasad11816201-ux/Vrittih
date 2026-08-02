/* ICIRE — the ONE CHF salary parser (shared). Fails CLOSED: it returns a value
 * ONLY when a figure is explicitly in CHF, and performs NO currency conversion.
 * The CHF-only rule means we never *show* a non-CHF number, so a ₹/$/€ salary or
 * a vague "competitive" becomes null (nothing shown) rather than a guessed CHF. */

const NON_CHF = /₹|\binr\b|\brs\.?\b|\$|\busd\b|€|\beur\b|£|\bgbp\b|¥|\bjpy\b|\blpa\b|\baed\b|\bsgd\b/i
const IS_CHF = /chf|\bfr\.?\b|swiss\s*franc/i

export type ChfSalary = { min: number; max: number; display: string }

export function parseChfSalary(raw?: string | null): ChfSalary | null {
  if (!raw) return null
  if (NON_CHF.test(raw)) return null
  if (!IS_CHF.test(raw)) return null
  const nums: number[] = []
  for (const m of raw.matchAll(/(\d[\d'’.,\s]*\d|\d)\s*(k|m)?/gi)) {
    let t = m[1].replace(/[’'\s]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(/\.(?=\d{3}\b)/g, "")
    let n = parseFloat(t.replace(/,/g, "."))
    if (!isFinite(n)) continue
    const suf = (m[2] || "").toLowerCase()
    if (suf === "k") n *= 1000
    else if (suf === "m") n *= 1_000_000
    if (n >= 1000 && n <= 100_000_000) nums.push(n)
  }
  if (!nums.length) return null
  const min = Math.min(...nums), max = Math.max(...nums)
  return { min, max, display: fmt(min) + (max !== min ? "–" + fmt(max) : "") }
}

const fmt = (n: number) => "CHF " + Math.round(n).toLocaleString("de-CH").replace(/,/g, "’")

/** Aggregate a CHF salary range from real listings — median of mins & maxes.
 * Returns null when no listing carries a CHF figure (never invents one). */
export function aggregateChf(salaries: (string | null | undefined)[]): { range: ChfSalary; count: number } | null {
  const parsed = salaries.map(parseChfSalary).filter((x): x is ChfSalary => !!x)
  if (!parsed.length) return null
  const mins = parsed.map((p) => p.min).sort((a, b) => a - b)
  const maxs = parsed.map((p) => p.max).sort((a, b) => a - b)
  const med = (a: number[]) => a[Math.floor(a.length / 2)]
  const min = med(mins), max = med(maxs)
  return { range: { min, max, display: fmt(min) + (max !== min ? "–" + fmt(max) : "") }, count: parsed.length }
}
