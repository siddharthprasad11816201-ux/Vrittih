/* Pure coupon math — no imports, unit-tested. Kept separate from lib/coupon.ts
 * (which touches the DB) so the discount algorithm can be verified in isolation. */

export type DiscountResult = { discountCHF: number; finalCHF: number; waiver: boolean }

const round2 = (n: number) => Math.round(n * 100) / 100

/** Given a coupon kind/value and a CHF amount, return the discount, the final
 * payable, and whether it fully waives the charge. Clamped and non-negative. */
export function computeDiscount(kind: string, value: number, amountCHF: number): DiscountResult {
  const amt = Math.max(0, amountCHF)
  let discount = 0
  if (kind === "percent") discount = amt * (Math.max(0, Math.min(100, value)) / 100)
  else if (kind === "fixed") discount = Math.min(Math.max(0, value), amt)
  else if (kind === "waiver") discount = amt
  discount = round2(Math.max(0, Math.min(amt, discount)))
  const finalCHF = round2(Math.max(0, amt - discount))
  return { discountCHF: discount, finalCHF, waiver: finalCHF <= 0 }
}

export function normalizeCode(raw: string): string {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "")
}
