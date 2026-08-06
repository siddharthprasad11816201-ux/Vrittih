import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/* Clinical Operations Assistant — via the AIOS gateway (audited). Operational metrics
 * (attendance/no-show, population demographics, records coverage) + a brain-deliberated
 * verdict. OPERATIONAL only — never diagnosis or medical advice. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const r = await execute("health.clinical.assistant", { subjectId: ctx.userId, caps: Array.from(ctx.capabilities) })
  if (!r.ok) return NextResponse.json({ error: r.error || "Clinical assistant unavailable." }, { status: 500 })
  return NextResponse.json({ ...r.output, explanation: r.explanation, runId: r.runId })
}
