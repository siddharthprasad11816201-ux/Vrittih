import { NextRequest, NextResponse } from "next/server"
import { recomputeCalibration } from "@/lib/career/calibrationStore"

export const dynamic = "force-dynamic"

/* ICIRE §21 — scheduled recompute of match calibration from real application
 * outcomes. Auth mirrors /api/cron/ingest: Vercel cron Bearer $CRON_SECRET, a
 * manual x-worker-secret, or localhost when neither secret is set. */
async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const workerSecret = process.env.WORKER_SECRET
  const okCron = cronSecret && (req.headers.get("authorization") || "") === `Bearer ${cronSecret}`
  const okWorker = workerSecret && (req.headers.get("x-worker-secret") || "") === workerSecret
  const host = req.headers.get("host") || ""
  const okLocal = !cronSecret && !workerSecret && (host.startsWith("localhost") || host.startsWith("127.0.0.1"))
  if (!okCron && !okWorker && !okLocal) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const summary = await recomputeCalibration()
  return NextResponse.json({ ok: true, at: new Date().toISOString(), ...summary })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
