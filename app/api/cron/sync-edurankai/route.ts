import { NextRequest, NextResponse } from "next/server"
import { syncEdurankai } from "@/lib/edurankaiSync"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/* Scheduled sync: pulls the current EduRankAI careers roles and reconciles them
 * into Vrittih — new roles appear, closed roles deactivate, existing ones update
 * in place (stable ids). Runs on the Vercel cron below, and can be triggered
 * manually with the worker secret.
 *
 * Needs EDURANKAI_DATABASE_URL set to the EduRankAI Postgres (read-only use).
 * Auth: Vercel cron sends `Authorization: Bearer $CRON_SECRET`; a manual caller
 * can send `x-worker-secret: $WORKER_SECRET`. If neither secret is configured,
 * only localhost is allowed so it can't be invoked anonymously in production. */
async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const workerSecret = process.env.WORKER_SECRET
  const auth = req.headers.get("authorization") || ""
  const provided = req.headers.get("x-worker-secret") || ""
  const host = req.headers.get("host") || ""
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1")

  const okCron = cronSecret && auth === `Bearer ${cronSecret}`
  const okWorker = workerSecret && provided === workerSecret
  const okLocal = !cronSecret && !workerSecret && isLocal
  if (!okCron && !okWorker && !okLocal) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const sourceUrl = process.env.EDURANKAI_DATABASE_URL
  if (!sourceUrl || !/^postgres/.test(sourceUrl)) {
    return NextResponse.json(
      { error: "EDURANKAI_DATABASE_URL is not set to a Postgres URL. Set it to the EduRankAI database so the sync has a source." },
      { status: 503 },
    )
  }

  try {
    const result = await syncEdurankai(sourceUrl)
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sync failed" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
