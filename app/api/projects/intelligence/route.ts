import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/* AI Project Manager — runs through the AIOS gateway (audited via AiRun). Returns a
 * portfolio standup, per-project insights (velocity/forecast/risk), and resource load.
 * Pass ?projectId=… to focus a single project. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const projectId = req.nextUrl.searchParams.get("projectId") || undefined
  const r = await execute("project.manager", { subjectId: ctx.userId, caps: Array.from(ctx.capabilities), input: { projectId } })
  if (!r.ok) return NextResponse.json({ error: r.error || "Project Manager unavailable." }, { status: 500 })
  return NextResponse.json({ ...r.output, explanation: r.explanation, runId: r.runId })
}
