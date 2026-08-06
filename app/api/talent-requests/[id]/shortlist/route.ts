import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 120
const isHr = (ctx: any) => ctx.has("admin.access") || ctx.has("candidates.view") || ctx.has("pipeline.manage") || ctx.has("jobs.post")

/* Recruiter Copilot — run the Enterprise Brain over the pool for this requirement and return
 * evidence-ranked best candidates (why/confidence/risks/missing + salary + interview plan).
 * Audited via AiRun. Only the owning employer or an HR operator may run it. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const reqRow = await prisma.talentRequest.findUnique({ where: { id: params.id }, select: { employerId: true, status: true } })
  if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (reqRow.employerId !== ctx.userId && !isHr(ctx)) return NextResponse.json({ error: "Not your requirement." }, { status: 403 })

  const r = await execute("recruit.shortlist", { subjectId: ctx.userId, caps: Array.from(ctx.capabilities), input: { requestId: params.id } })
  if (!r.ok) return NextResponse.json({ error: r.error || "Shortlist unavailable." }, { status: 500 })
  // Mark the requirement as in-progress once sourcing has run.
  if (reqRow.status === "OPEN") await prisma.talentRequest.update({ where: { id: params.id }, data: { status: "IN_PROGRESS" } }).catch(() => {})
  return NextResponse.json({ ...r.output, explanation: r.explanation, runId: r.runId })
}
