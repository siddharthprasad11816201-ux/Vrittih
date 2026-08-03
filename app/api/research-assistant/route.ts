import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/* Phase 3 Module 5 — Research AI Assistant. In-house literature retrieval via the AIOS
 * gateway (audited); no external LLM. */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const question = String(b.question || "").slice(0, 500)
  if (!question.trim()) return NextResponse.json({ error: "Ask a research question or topic." }, { status: 400 })
  const r = await execute("research.assistant", { subjectId: ctx.userId, input: { question } })
  if (!r.ok) return NextResponse.json({ error: r.error || "Assistant unavailable." }, { status: 500 })
  return NextResponse.json({ ...r.output, runId: r.runId })
}
