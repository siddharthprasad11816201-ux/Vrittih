import { NextRequest, NextResponse } from "next/server"
import { drain, queueStats } from "@/lib/jobs"
import { ensureHandlers } from "@/lib/jobHandlers"

export const dynamic = "force-dynamic"

// Drains due background jobs. Called by server/worker.js on an interval, or by
// an admin. Protected by a shared secret (WORKER_SECRET); if unset, allow only
// from localhost so the dev worker still functions.
export async function POST(req: NextRequest) {
  const secret = process.env.WORKER_SECRET
  const provided = req.headers.get("x-worker-secret")
  const host = req.headers.get("host") || ""
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1")
  if (secret ? provided !== secret : !isLocal) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  ensureHandlers()
  const processed = await drain(100)
  const stats = await queueStats()
  return NextResponse.json({ processed, stats })
}
