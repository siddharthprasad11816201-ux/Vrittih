import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/* AI Career Coach — role readiness. POST { targetRole } → evidence-based readiness verdict,
 * gap analysis and a learning plan, deliberated by the Enterprise Brain (audited). */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { targetRole } = await req.json().catch(() => ({}))
  if (!targetRole || !String(targetRole).trim()) return NextResponse.json({ error: "Tell me the role you want to grow into." }, { status: 400 })
  const r = await execute("career.coach.readiness", { subjectId: ctx.userId, caps: Array.from(ctx.capabilities), input: { targetRole: String(targetRole).trim().slice(0, 120) } })
  if (!r.ok) return NextResponse.json({ error: r.error || "Career coach unavailable." }, { status: 500 })
  return NextResponse.json({ ...r.output, runId: r.runId })
}
