import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { evaluateInterview, type EvidenceItem } from "@/lib/interview/evidence"
import { logAction } from "@/lib/admin"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

const HUMAN_DECISIONS = ["ADVANCE", "REJECT", "ANOTHER_ROUND", "HOLD"] as const

async function panelAccess(interviewId: string, userId: string, role: string) {
  const iv = await (prisma as any).interview.findUnique({
    where: { id: interviewId },
    select: { id: true, hostId: true, status: true, applicationId: true, plan: { select: { competencies: true } }, participants: { select: { userId: true, role: true } } },
  })
  if (!iv) return { ok: false as const, status: 404, error: "Interview not found" }
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN"
  const me = iv.participants.find((p: any) => p.userId === userId)
  const isPanel = iv.hostId === userId || (me && me.role !== "CANDIDATE")
  if (!isPanel && !isAdmin) return { ok: false as const, status: 403, error: "Forbidden" }
  return { ok: true as const, interview: iv, isAdmin }
}

/**
 * Compute (and persist) the evidence-based evaluation.
 *
 * This is a RECOMMENDATION only. Per decision governance (§33) the system never finalises
 * a hiring outcome on its own: `humanDecision` stays null until a person records one, and
 * the recommendation can be INSUFFICIENT_EVIDENCE, which is an honest "we do not know"
 * rather than a manufactured score.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const access = await panelAccess(params.id, payload.userId, payload.role)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  let required: string[] = []
  try { required = JSON.parse(access.interview.plan?.competencies || "[]") } catch { required = [] }

  const rows = await (prisma as any).interviewEvidence.findMany({ where: { interviewId: params.id }, take: 500 })
  const evidence: EvidenceItem[] = rows.map((r: any) => ({
    competencyKey: r.competencyKey, source: r.source, level: r.level, excerpt: r.excerpt,
  }))
  const evaluation = evaluateInterview(required, evidence)

  const coverageNote = evaluation.unassessed.length
    ? `Not assessed: ${evaluation.unassessed.join(", ")}. This evaluation does not cover them.`
    : null

  const saved = await (prisma as any).interviewEvaluation.upsert({
    where: { interviewId: params.id },
    create: {
      interviewId: params.id,
      competenciesJson: JSON.stringify(evaluation.competencies),
      overall: evaluation.overall,
      confidence: evaluation.overallConfidence,
      recommendation: evaluation.recommendation,
      coverageNote,
      computedBy: "system",
    },
    update: {
      competenciesJson: JSON.stringify(evaluation.competencies),
      overall: evaluation.overall,
      confidence: evaluation.overallConfidence,
      recommendation: evaluation.recommendation,
      coverageNote,
    },
  })

  return NextResponse.json({
    ok: true,
    evaluation,
    stored: { id: saved.id, humanDecision: saved.humanDecision ?? null },
    note: "This is a recommendation derived from recorded evidence. A human decision is required to act on it.",
  })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const access = await panelAccess(params.id, payload.userId, payload.role)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const row = await (prisma as any).interviewEvaluation.findUnique({ where: { interviewId: params.id } })
  if (!row) return NextResponse.json({ evaluation: null, note: "No evaluation computed yet." })
  let competencies: any[] = []
  try { competencies = JSON.parse(row.competenciesJson || "[]") } catch { competencies = [] }
  return NextResponse.json({ evaluation: { ...row, competencies } })
}

/** Record the HUMAN decision. The AI recommendation never becomes the decision by itself. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const access = await panelAccess(params.id, payload.userId, payload.role)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  try {
    const body = await req.json()
    const decision = String(body?.decision || "")
    if (!(HUMAN_DECISIONS as readonly string[]).includes(decision)) {
      return NextResponse.json({ error: `decision must be one of: ${HUMAN_DECISIONS.join(", ")}.` }, { status: 400 })
    }
    const existing = await (prisma as any).interviewEvaluation.findUnique({ where: { interviewId: params.id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: "Compute the evaluation before recording a decision." }, { status: 409 })

    const updated = await (prisma as any).interviewEvaluation.update({
      where: { interviewId: params.id },
      data: {
        humanDecision: decision,
        humanReviewedById: payload.userId,
        humanNote: typeof body?.note === "string" ? body.note.slice(0, 2000) : null,
        decidedAt: new Date(),
      },
    })
    // Every material hiring action is audited.
    await logAction(payload.userId, "interview.decision", { interviewId: params.id, decision }, req)
    return NextResponse.json({ ok: true, decision: updated.humanDecision, decidedAt: updated.decidedAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
