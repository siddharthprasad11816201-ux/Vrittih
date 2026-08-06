import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/* Campus Intelligence — via the AIOS gateway (audited). Admissions funnel/yield, seat
 * utilisation, placement, GPA distribution, at-risk students, ratio + recommendations. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const r = await execute("university.intelligence", { subjectId: ctx.userId, caps: Array.from(ctx.capabilities) })
  if (!r.ok) return NextResponse.json({ error: r.error || "Campus intelligence unavailable." }, { status: 500 })
  return NextResponse.json({ ...r.output, explanation: r.explanation, runId: r.runId })
}
