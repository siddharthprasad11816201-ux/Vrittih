import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/* EAIL — the unified deliberation core, exposed through the AIOS gateway (audited via
 * AiRun). POST a Brief (role, question, evidence, competency, criteria, options) and get
 * back an evidence-based, explainable, confidence-scored, self-reflective Deliberation.
 * Every AI product can route a decision through this one reasoning core. */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const brief = await req.json().catch(() => ({}))
  const r = await execute("intelligence.deliberate", { subjectId: ctx.userId, caps: Array.from(ctx.capabilities), input: { brief } })
  if (!r.ok) return NextResponse.json({ error: r.error || "Deliberation unavailable." }, { status: 500 })
  return NextResponse.json({ ...r.output, runId: r.runId })
}
