import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 120
const canHr = (ctx: any) => ctx.has("hrms.view") || ctx.has("admin.access") || ctx.has("payroll.view")

/* HR Copilot — via the AIOS gateway (audited). Evidence-based attrition risk + promotion
 * readiness for the caller's workforce, each verdict deliberated by the Enterprise Brain. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canHr(ctx)) return NextResponse.json({ error: "HR access required." }, { status: 403 })
  const r = await execute("hr.copilot", { subjectId: ctx.userId, caps: Array.from(ctx.capabilities) })
  if (!r.ok) return NextResponse.json({ error: r.error || "HR copilot unavailable." }, { status: 500 })
  return NextResponse.json({ ...r.output, explanation: r.explanation, runId: r.runId })
}
