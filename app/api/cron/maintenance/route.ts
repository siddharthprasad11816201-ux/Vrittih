import { NextRequest, NextResponse } from "next/server"
import { sweepRateLimits } from "@/lib/ratelimit/store"
import { sweepOtps } from "@/lib/auth/otp"

export const dynamic = "force-dynamic"

/* Housekeeping for the security tables. The rate-limit and OTP counters are append-heavy
 * and must not grow without bound. Auth mirrors the other cron routes; the Host-header
 * fallback is dev-only because Host is attacker-controlled. */
async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const workerSecret = process.env.WORKER_SECRET
  const okCron = cronSecret && (req.headers.get("authorization") || "") === `Bearer ${cronSecret}`
  const okWorker = workerSecret && (req.headers.get("x-worker-secret") || "") === workerSecret
  const host = req.headers.get("host") || ""
  const okLocal = process.env.NODE_ENV !== "production" && !cronSecret && !workerSecret && (host.startsWith("localhost") || host.startsWith("127.0.0.1"))
  if (!okCron && !okWorker && !okLocal) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const now = new Date()
  // Report failures rather than swallowing them — a silently broken sweep means unbounded
  // table growth that only shows up as a production incident weeks later.
  const errors: string[] = []
  let rateHits = 0, otps = 0
  try { rateHits = await sweepRateLimits(now) } catch (e: any) { errors.push(`rateLimits: ${e?.message || e}`) }
  try { otps = await sweepOtps(now) } catch (e: any) { errors.push(`otps: ${e?.message || e}`) }

  return NextResponse.json(
    { ok: errors.length === 0, at: now.toISOString(), swept: { rateHits, otps }, errors },
    { status: errors.length ? 500 : 200 },
  )
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
