import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 60
const canManage = (ctx: any) => ctx.has("pipeline.manage") || ctx.has("jobs.post") || ctx.has("candidates.view") || ctx.has("admin.access")

/* EROS Batch 6 — Recruiter Copilot. Runs through the AIOS gateway (audited via AiRun),
 * returning prioritised, explainable next-best-actions from the recruiter's real state. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const r = await execute("recruit.copilot", { subjectId: ctx.userId, input: { isAdmin: ctx.has("admin.access") } })
  if (!r.ok) return NextResponse.json({ error: r.error || "Copilot unavailable." }, { status: 500 })
  return NextResponse.json({ ...r.output, runId: r.runId })
}
