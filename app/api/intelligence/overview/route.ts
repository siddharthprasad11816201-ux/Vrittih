import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { computeIntelligence } from "@/lib/intelligence/health"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/* EIDP — the Executive Workspace feed: org-health index, per-domain health, ranked
 * decision cards, forecasts, and headline stats. Capability-gated (never role):
 * requires ai.ops.view (the intelligence/AI-ops surface) or admin.access. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!ctx.has("ai.ops.view") && !ctx.has("admin.access")) {
    return NextResponse.json({ error: "The Executive Workspace requires intelligence access." }, { status: 403 })
  }
  try {
    const snapshot = await computeIntelligence()
    return NextResponse.json(snapshot)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to compute intelligence." }, { status: 500 })
  }
}
