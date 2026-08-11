import { NextRequest, NextResponse } from "next/server"
import { allSourcesAsync } from "@/lib/sources"
import { ingestSource, expireClosed } from "@/lib/ingest"
import { retryDue } from "@/lib/webhooks"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/* Scheduled ingestion of every registered job feed. Each site publishes a JSON
 * feed of its open roles; this pulls them all and reconciles (new appear, closed
 * deactivate) — no database access to any site. Add a site with a JobSource row
 * carrying its feedUrl (admin → sources), and it joins this run automatically.
 *
 * Auth: Vercel cron sends Authorization: Bearer $CRON_SECRET; a manual caller
 * sends x-worker-secret: $WORKER_SECRET. With neither secret set, only localhost
 * is allowed. */
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

  const sources = await allSourcesAsync()
  const reports = []
  for (const s of sources) reports.push(await ingestSource(s))
  const expired = await expireClosed()
  const webhooksRetried = await retryDue().catch(() => 0)

  return NextResponse.json({ ok: true, at: new Date().toISOString(), sources: sources.length, reports, expired, webhooksRetried })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
