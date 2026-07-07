import { NextResponse } from "next/server"
import { getRates, CURRENCIES, convertFromCHF } from "@/lib/fx"
import { JOINING_FEE_CHF } from "@/lib/payment"

export const dynamic = "force-dynamic"

// Live per-currency price of the joining fee, for the checkout currency selector.
export async function GET() {
  const { rates, live } = await getRates()
  const prices = CURRENCIES.map(c => {
    const rate = rates[c.code] ?? 1
    const { amount } = convertFromCHF(JOINING_FEE_CHF, c.code, rate)
    return { code: c.code, name: c.name, symbol: c.symbol, amount, rate: Math.round(rate * 10000) / 10000 }
  })
  return NextResponse.json({ base: "CHF", fee: JOINING_FEE_CHF, live, prices })
}
