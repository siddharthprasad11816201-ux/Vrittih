import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { featureGate } from "@/lib/guard"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/* AI Sales Assistant — runs through the AIOS gateway (audited via AiRun). Returns a
 * per-currency pipeline, win rate, campaign performance, ticket health, and prioritised
 * next-best-actions from the caller's real CRM workspace. */
export async function GET(req: NextRequest) {
  const gate = await featureGate(req, "crm"); if (gate instanceof NextResponse) return gate
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const r = await execute("crm.sales.assistant", { subjectId: ctx.userId, caps: Array.from(ctx.capabilities) })
  if (!r.ok) return NextResponse.json({ error: r.error || "Sales assistant unavailable." }, { status: 500 })
  return NextResponse.json({ ...r.output, explanation: r.explanation, runId: r.runId })
}
