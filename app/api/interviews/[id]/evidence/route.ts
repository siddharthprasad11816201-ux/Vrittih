import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { evaluateInterview, nextCompetencyToProbe, isUsable, type EvidenceItem, type EvidenceSource } from "@/lib/interview/evidence"
import { rateLimit } from "@/lib/ratelimit/store"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

const SOURCES: EvidenceSource[] = ["interview_answer", "code_sample", "work_sample", "assessment", "reference", "resume_claim"]

/** Only the panel (host/panelists) or an admin may see or record evidence — never the candidate. */
async function panelAccess(interviewId: string, userId: string, role: string) {
  const iv = await (prisma as any).interview.findUnique({
    where: { id: interviewId },
    select: { id: true, hostId: true, planId: true, plan: { select: { competencies: true } }, participants: { select: { userId: true, role: true } } },
  })
  if (!iv) return { ok: false as const, status: 404, error: "Interview not found" }
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN"
  const me = iv.participants.find((p: any) => p.userId === userId)
  const isPanel = iv.hostId === userId || (me && me.role !== "CANDIDATE")
  if (!isPanel && !isAdmin) return { ok: false as const, status: 403, error: "Forbidden" }
  return { ok: true as const, interview: iv }
}

function requiredCompetencies(iv: any): string[] {
  try { return JSON.parse(iv.plan?.competencies || "[]") } catch { return [] }
}

// Current evidence, the computed evaluation, and what to probe next (adaptive loop).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const access = await panelAccess(params.id, payload.userId, payload.role)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const rows = await (prisma as any).interviewEvidence.findMany({ where: { interviewId: params.id }, orderBy: { createdAt: "asc" }, take: 500 })
  const evidence: EvidenceItem[] = rows.map((r: any) => ({
    competencyKey: r.competencyKey, source: r.source, level: r.level, excerpt: r.excerpt, questionId: r.questionId, recordedBy: r.recordedById,
  }))
  const required = requiredCompetencies(access.interview)
  const evaluation = evaluateInterview(required, evidence)

  return NextResponse.json({
    evidence: rows,
    evaluation,
    // Adaptive: the least-certain competency is what the interviewer should probe next,
    // instead of walking a fixed question list.
    nextToProbe: nextCompetencyToProbe(evaluation),
  })
}

// Record one observed, quotable fact. A rating with no excerpt is rejected: an assertion
// is not evidence, and a score must always be traceable to something that was said or done.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const rl = await rateLimit("write", payload.userId, { scope: "evidence" })
  if (!rl.allowed) return NextResponse.json({ error: "Too many updates. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

  const access = await panelAccess(params.id, payload.userId, payload.role)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  try {
    const body = await req.json()
    const competencyKey = String(body?.competencyKey || "").trim().slice(0, 80)
    const source = String(body?.source || "")
    const level = Number(body?.level)
    const excerpt = String(body?.excerpt || "").trim().slice(0, 4000)

    if (!competencyKey) return NextResponse.json({ error: "competencyKey is required." }, { status: 400 })
    if (!SOURCES.includes(source as EvidenceSource)) {
      return NextResponse.json({ error: `source must be one of: ${SOURCES.join(", ")}.` }, { status: 400 })
    }
    if (!Number.isInteger(level) || level < 0 || level > 4) {
      return NextResponse.json({ error: "level must be an integer 0–4 (rubric)." }, { status: 400 })
    }
    const item: EvidenceItem = { competencyKey, source: source as EvidenceSource, level: level as any, excerpt }
    if (!isUsable(item)) {
      return NextResponse.json({ error: "An excerpt is required — a rating without a quoted justification is not evidence." }, { status: 400 })
    }

    const row = await (prisma as any).interviewEvidence.create({
      data: {
        interviewId: params.id, competencyKey, source, level, excerpt,
        questionId: body?.questionId ? String(body.questionId).slice(0, 80) : null,
        recordedById: payload.userId,
      },
    })
    return NextResponse.json({ ok: true, id: row.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
