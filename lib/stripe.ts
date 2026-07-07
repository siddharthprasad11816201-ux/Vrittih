// Minimal Stripe client over plain REST (no SDK). Stripe is the payment rail —
// cards worldwide incl. Europe, 135+ currencies, 3DS, Apple/Google Pay, hosted
// PCI-compliant checkout. We only ever talk to it over HTTPS with the secret key.
import crypto from "crypto"

const API = "https://api.stripe.com/v1"
const SECRET = process.env.STRIPE_SECRET_KEY || ""
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ""

export const stripeConfigured = () => SECRET.startsWith("sk_")

// Flatten nested params into Stripe's form-encoded bracket notation.
function encode(obj: any, prefix = "", out: string[] = []): string[] {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (typeof v === "object" && !Array.isArray(v)) encode(v, key, out)
    else if (Array.isArray(v)) v.forEach((item, i) => typeof item === "object" ? encode(item, `${key}[${i}]`, out) : out.push(`${key}[${i}]=${encodeURIComponent(String(item))}`))
    else out.push(`${key}=${encodeURIComponent(String(v))}`)
  }
  return out
}

async function stripe(method: "POST" | "GET", path: string, params?: any) {
  if (!stripeConfigured()) throw new Error("Payments are not configured yet (missing STRIPE_SECRET_KEY).")
  const url = API + path + (method === "GET" && params ? "?" + encode(params).join("&") : "")
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" && params ? encode(params).join("&") : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || "Stripe request failed")
  return data
}

export async function createCheckoutSession(opts: {
  currency: string; minorUnits: number; userId: string; type: string; feeCHF: number
  email?: string; successUrl: string; cancelUrl: string
}) {
  return stripe("POST", "/checkout/sessions", {
    mode: "payment",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    customer_email: opts.email,
    client_reference_id: opts.userId,
    metadata: { userId: opts.userId, type: opts.type, feeCHF: String(opts.feeCHF) },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: opts.currency.toLowerCase(),
        unit_amount: opts.minorUnits,
        product_data: { name: "Vrittih — lifetime membership", description: `One-time joining fee (${opts.feeCHF} CHF)` },
      },
    }],
  })
}

export async function retrieveSession(id: string) {
  return stripe("GET", `/checkout/sessions/${id}`)
}

// Verify a Stripe webhook signature (t=…,v1=… scheme). Returns the parsed event or null.
export function verifyWebhook(payload: string, sigHeader: string | null): any | null {
  if (!WEBHOOK_SECRET || !sigHeader) return null
  const parts = Object.fromEntries(sigHeader.split(",").map(p => p.split("=")))
  const t = parts.t, v1 = parts.v1
  if (!t || !v1) return null
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${payload}`).digest("hex")
  if (expected.length !== v1.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) return null
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return null // 5-min tolerance
  try { return JSON.parse(payload) } catch { return null }
}
