import { NextRequest, NextResponse } from "next/server"
import { drain, queueStats } from "@/lib/jobs"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Background job processor for serverless (Vercel Cron or any external cron hits this).
// Replaces the always-on server/worker.js. Secured by CRON_SECRET when set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const processed = await drain(100)
  const stats = await queueStats()
  return NextResponse.json({ ok: true, processed, stats })
}
