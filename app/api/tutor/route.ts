import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/* ELTOS Module 5 — in-house AI Tutor. Runs through the AIOS gateway (audited via AiRun).
 * Deterministic pedagogy from the learner's gap + the curated resource graph; no LLM. */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const question = String(b.question || "").slice(0, 500)
  if (!question.trim()) return NextResponse.json({ error: "Ask a question." }, { status: 400 })
  const r = await execute("learning.tutor", { subjectId: ctx.userId, input: { question, days: Number(b.days) || 14 } })
  if (!r.ok) return NextResponse.json({ error: r.error || "Tutor unavailable." }, { status: 500 })
  return NextResponse.json({ ...r.output, runId: r.runId })
}
