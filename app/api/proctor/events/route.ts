import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { classify, sessionRisk, suggestedReview } from "@/lib/proctor/events"

export const dynamic = "force-dynamic"

/* EROS Module 6/7 — Semantic Proctoring ingest (Phase 1).
 * The candidate's OWN browser posts observable integrity events for THEIR session.
 * CONSENT-GATED: nothing is recorded without an explicit consent flag; a session is
 * created only with consent. Events are metadata only (never raw media). Risk is a
 * deterministic triage score that routes to human review — never a verdict. */

const MAX_EVENTS = 100

export async function POST(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const b = await req.json()
  const kind = b.kind === "assessment" ? "assessment" : "interview"
  const refId = String(b.refId || "").slice(0, 80)
  const consent = b.consent === true
  if (!refId) return NextResponse.json({ error: "refId required" }, { status: 400 })

  const incoming: any[] = Array.isArray(b.events) ? b.events.slice(0, MAX_EVENTS) : []

  // A candidate proctors only their OWN session (subject = caller).
  let session = await prisma.proctorSession.findFirst({ where: { kind, refId, subjectId: p.userId } })
  if (!session) {
    // No consent, no session — refuse to record anything.
    if (!consent) return NextResponse.json({ recorded: 0, consent: false, message: "Consent is required to record integrity events." })
    session = await prisma.proctorSession.create({
      data: { kind, refId, subjectId: p.userId, consent: true, consentAt: new Date(), status: "ACTIVE" },
    })
  }
  // Consent is revocable: if the client now signals consent:false, stop recording + end.
  if (b.consent === false) {
    await prisma.proctorSession.update({ where: { id: session.id }, data: { consent: false, status: "ENDED", endedAt: new Date() } }).catch(() => {})
    return NextResponse.json({ recorded: 0, consent: false, sessionId: session.id })
  }
  if (!session.consent) return NextResponse.json({ recorded: 0, consent: false, sessionId: session.id })

  // Append classified events (severity assigned in-house; evidence = metadata only).
  let recorded = 0
  for (const e of incoming) {
    const def = classify(String(e.type || ""))
    const conf = typeof e.confidence === "number" ? Math.max(0, Math.min(1, e.confidence)) : 1
    await prisma.proctorEvent.create({
      data: {
        sessionId: session.id, type: def.type, source: String(e.source || "browser").slice(0, 20),
        ts: e.ts ? new Date(e.ts) : new Date(), confidence: conf, severity: def.severity,
        policyRef: def.policyRef,
        evidence: e.evidence ? JSON.stringify(e.evidence).slice(0, 2000) : null,
      },
    }).then(() => recorded++).catch(() => {})
  }

  // Recompute the deterministic risk score from ALL of the session's events.
  const all = await prisma.proctorEvent.findMany({ where: { sessionId: session.id }, select: { type: true, confidence: true } })
  const risk = sessionRisk(all)
  const patch: any = { riskScore: risk.score }
  // Never override a human decision; only auto-set while still PENDING.
  if (session.reviewStatus === "PENDING") patch.reviewStatus = suggestedReview(risk.score)
  await prisma.proctorSession.update({ where: { id: session.id }, data: patch }).catch(() => {})

  return NextResponse.json({ recorded, sessionId: session.id, riskScore: risk.score, band: risk.band, consent: true })
}
