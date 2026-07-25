import { prisma } from "@/lib/prisma"
import { PLANS, ADDONS, type Plan } from "@/lib/plans"

/* Effective pricing = the defaults in lib/plans.ts, overridden by whatever an
   admin has set in the Setting table. Prices are money: they are stored in one
   place, read through one function, and every write is validated and logged.

   Keys: plan.<id>.priceCHF   addon.<id>.priceCHF */

const KEY = (id: string) => `plan.${id}.priceCHF`
const ADDON_KEY = (id: string) => `addon.${id}.priceCHF`

// Small in-process cache: pricing is read on every pricing/pay render but changes
// rarely. Cleared immediately on write so an admin sees their edit at once.
let cache: { at: number; plans: Plan[]; addons: any[] } | null = null
const TTL = 30_000
export function clearPricingCache() { cache = null }

export async function getPricing(): Promise<{ plans: Plan[]; addons: any[] }> {
  if (cache && Date.now() - cache.at < TTL) return { plans: cache.plans, addons: cache.addons }

  let overrides: Record<string, number> = {}
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { startsWith: "plan." } },
      select: { key: true, value: true },
    })
    const addonRows = await prisma.setting.findMany({
      where: { key: { startsWith: "addon." } },
      select: { key: true, value: true },
    })
    for (const r of [...rows, ...addonRows]) {
      const n = Number(r.value)
      if (Number.isFinite(n) && n >= 0) overrides[r.key] = n
    }
  } catch {
    // If settings are unreadable we fall back to code defaults rather than
    // showing nothing — a pricing page that fails to render sells nothing.
  }

  const plans = PLANS.map(p => {
    const o = overrides[KEY(p.id)]
    return o === undefined ? p : { ...p, priceCHF: o }
  })
  const addons = ADDONS.map(a => {
    const o = overrides[ADDON_KEY(a.id)]
    return o === undefined ? a : { ...a, priceCHF: o }
  })

  cache = { at: Date.now(), plans, addons }
  return { plans, addons }
}

export async function getEffectivePlan(id: string): Promise<Plan | undefined> {
  const { plans } = await getPricing()
  return plans.find(p => p.id === id)
}

// Validate before writing. Rejects nonsense so a typo cannot put a plan at a
// price nobody intended — this is the number customers are charged.
export function validatePrice(v: unknown): { ok: true; value: number } | { ok: false; error: string } {
  const n = Number(v)
  if (!Number.isFinite(n)) return { ok: false, error: "Price must be a number." }
  if (n < 0) return { ok: false, error: "Price cannot be negative." }
  if (n > 100000) return { ok: false, error: "Price looks wrong (over 100,000 CHF)." }
  return { ok: true, value: Math.round(n * 100) / 100 }
}

export async function setPlanPrice(planId: string, priceCHF: number) {
  const key = PLANS.some(p => p.id === planId) ? KEY(planId)
    : ADDONS.some(a => a.id === planId) ? ADDON_KEY(planId) : null
  if (!key) throw new Error("Unknown plan or add-on")
  await prisma.setting.upsert({
    where: { key },
    update: { value: String(priceCHF) },
    create: { key, value: String(priceCHF) },
  })
  clearPricingCache()
}

export async function resetPlanPrice(planId: string) {
  const key = PLANS.some(p => p.id === planId) ? KEY(planId) : ADDON_KEY(planId)
  await prisma.setting.deleteMany({ where: { key } })
  clearPricingCache()
}
