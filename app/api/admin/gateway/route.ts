import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

export const dynamic = "force-dynamic"

// Real payment-gateway control. "Connected" is derived from whether the gateway's
// credentials exist in the environment (you connect a gateway by configuring its
// keys, not by a cosmetic toggle); the active choice and any manual disable are
// persisted in Settings so the switch actually sticks.
const ACTIVE_KEY = "payment.active"
const DISABLED_KEY = "payment.disabled"

function envConnected(id: string): boolean {
  if (id === "razorpay") return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  if (id === "stripe") return !!process.env.STRIPE_SECRET_KEY
  if (id === "manual") return true
  return false // crypto: not implemented
}
function testMode(id: string): boolean {
  if (id === "razorpay") return (process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test")
  if (id === "stripe") return (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test")
  return false
}

const DEFS = [
  { id: "razorpay", label: "Razorpay" },
  { id: "stripe", label: "Stripe" },
  { id: "manual", label: "Manual / Bank transfer" },
  { id: "crypto", label: "Crypto" },
]

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? null
}
async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

async function buildState() {
  const disabled: string[] = JSON.parse((await getSetting(DISABLED_KEY)) || "[]")
  const active = (await getSetting(ACTIVE_KEY)) || process.env.ACTIVE_PAYMENT_GATEWAY || "razorpay"
  const gateways = DEFS.map((g) => ({
    ...g,
    connected: envConnected(g.id) && !disabled.includes(g.id),
    testMode: testMode(g.id),
    active: false as boolean,
  }))
  // active must point at a connected gateway; fall back to the first connected one
  const activeGw = gateways.find((g) => g.id === active && g.connected) || gateways.find((g) => g.connected)
  if (activeGw) activeGw.active = true
  return { gateways, active: activeGw?.id || null }
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  const { gateways } = await buildState()
  return NextResponse.json({ gateways })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  const { action, gatewayId } = await req.json()
  const id = String(gatewayId || "")
  if (!DEFS.some((g) => g.id === id)) return NextResponse.json({ error: "Unknown gateway" }, { status: 400 })

  let disabled: string[] = JSON.parse((await getSetting(DISABLED_KEY)) || "[]")

  if (action === "set_active") {
    if (!envConnected(id) || disabled.includes(id)) return NextResponse.json({ error: "Connect this gateway before making it active." }, { status: 400 })
    await setSetting(ACTIVE_KEY, id)
  } else if (action === "connect") {
    if (!envConnected(id)) return NextResponse.json({ error: `${id} has no credentials configured. Set its keys in the environment to connect it.` }, { status: 400 })
    disabled = disabled.filter((d) => d !== id)
    await setSetting(DISABLED_KEY, JSON.stringify(disabled))
  } else if (action === "disconnect") {
    if (!disabled.includes(id)) disabled.push(id)
    await setSetting(DISABLED_KEY, JSON.stringify(disabled))
    if ((await getSetting(ACTIVE_KEY)) === id) await setSetting(ACTIVE_KEY, "")
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  const { gateways, active } = await buildState()
  return NextResponse.json({ ok: true, success: true, active, gateways })
}
