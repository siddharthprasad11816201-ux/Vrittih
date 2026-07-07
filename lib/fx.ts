// Live foreign-exchange for the joining fee. Base = CHF.
// Rates come from the European Central Bank reference set (frankfurter.dev — free,
// keyless). Cached in-memory for 1h; a static fallback keeps checkout working if the
// feed is briefly unreachable. This is a data feed, not a dependency.

export type CurrencyMeta = { code: string; name: string; symbol: string; zeroDecimal: boolean }

// Offered payment currencies (all in the ECB reference set except CHF, the base).
export const CURRENCIES: CurrencyMeta[] = [
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", zeroDecimal: false },
  { code: "EUR", name: "Euro", symbol: "€", zeroDecimal: false },
  { code: "USD", name: "US Dollar", symbol: "$", zeroDecimal: false },
  { code: "GBP", name: "British Pound", symbol: "£", zeroDecimal: false },
  { code: "INR", name: "Indian Rupee", symbol: "₹", zeroDecimal: false },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", zeroDecimal: true },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", zeroDecimal: false },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", zeroDecimal: false },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", zeroDecimal: false },
]
const ZERO_DECIMAL = new Set(CURRENCIES.filter(c => c.zeroDecimal).map(c => c.code))

// Approximate fallback (only used if the live feed fails). Refreshed automatically when the feed works.
const FALLBACK: Record<string, number> = {
  CHF: 1, EUR: 1.06, USD: 1.12, GBP: 0.90, INR: 96, JPY: 175, AUD: 1.70, CAD: 1.55, SGD: 1.47,
}

let cache: { rates: Record<string, number>; at: number } | null = null
const TTL = 60 * 60 * 1000 // 1h

export async function getRates(): Promise<{ rates: Record<string, number>; live: boolean }> {
  if (cache && Date.now() - cache.at < TTL) return { rates: cache.rates, live: true }
  const to = CURRENCIES.filter(c => c.code !== "CHF").map(c => c.code).join(",")
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=CHF&symbols=${to}`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) throw new Error("fx feed " + res.status)
    const data = await res.json()
    const rates = { CHF: 1, ...data.rates }
    cache = { rates, at: Date.now() }
    return { rates, live: true }
  } catch {
    return { rates: FALLBACK, live: false }
  }
}

export function isZeroDecimal(code: string) { return ZERO_DECIMAL.has(code) }

// Convert a CHF amount to the target currency, rounded to a chargeable value.
export function convertFromCHF(amountCHF: number, code: string, rate: number) {
  const raw = amountCHF * rate
  const amount = isZeroDecimal(code) ? Math.max(1, Math.round(raw)) : Math.round(raw * 100) / 100
  const minorUnits = isZeroDecimal(code) ? amount : Math.round(amount * 100) // Stripe smallest unit
  return { amount, minorUnits }
}

export function meta(code: string) { return CURRENCIES.find(c => c.code === code) }
