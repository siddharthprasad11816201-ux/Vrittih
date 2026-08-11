import { NextRequest, NextResponse } from "next/server"
import { drain } from "@/lib/aios/events"
import { runSelfEval } from "@/lib/aios/eval"

export const dynamic = "force-dynamic"

/* AIOS §23/§25 — background learning cron. Drains the event bus (fans platform
 * events out to registered handlers) and records the self-evaluation snapshot.
 * Auth mirrors /api/cron/ingest: Bearer CRON_SECRET, x-worker-secret, or localhost
 * when neither secret is set. Never modifies governed/forbidden surfaces (§27). */
async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const workerSecret = process.env.WORKER_SECRET
  const okCron = cronSecret && (req.headers.get("authorization") || "") === `Bearer ${cronSecret}`
  const okWorker = workerSecret && (req.headers.get("x-worker-secret") || "") === workerSecret
  const host = req.headers.get("host") || ""
  // The Host header is attacker-controlled, so it can never be an authorisation signal
  // on a deployed host. Only honour it when no secret is configured AND we are not in
  // production — i.e. genuine local development.
  const okLocal = process.env.NODE_ENV !== "production" && !cronSecret && !workerSecret && (host.startsWith("localhost") || host.startsWith("127.0.0.1"))
  if (!okCron && !okWorker && !okLocal) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const eventsProcessed = await drain(500).catch(() => 0)
  const metrics = await runSelfEval().catch(() => ({}))
  return NextResponse.json({ ok: true, at: new Date().toISOString(), eventsProcessed, metrics })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
