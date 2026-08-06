import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/* Candidate side of managed placement — via the AIOS gateway (audited). Ranks OPEN employer
 * requirements by fit for the calling candidate, each with evidence/confidence/missing skills. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const r = await execute("candidate.opportunities", { subjectId: ctx.userId, caps: Array.from(ctx.capabilities) })
  if (!r.ok) return NextResponse.json({ error: r.error || "Matching unavailable." }, { status: 500 })
  return NextResponse.json({ ...r.output, explanation: r.explanation, runId: r.runId })
}
