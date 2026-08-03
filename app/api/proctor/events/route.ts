import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { classify, isKnownType, sessionRisk, suggestedReview } from "@/lib/proctor/events"

export const dynamic = "force-dynamic"

/* EROS Module 6/7 — Semantic Proctoring ingest (Phase 1).
 * The candidate's OWN browser posts observable integrity events for THEIR session.
 * CONSENT-GATED: nothing is recorded without an explicit consent flag; a session is
 * created only with consent. Events are metadata only (never raw media). Risk is a
 * deterministic triage score that routes to human review — never a verdict. */

const MAX_EVENTS = 100

/* The caller may only proctor a session they are the legitimate SUBJECT of — a
 * participant of the interview, or the owner of the test attempt. */
async function ownsRef(kind: string, refId: string, userId: string): Promise<boolean> {
  if (kind === "assessment") {
    const a = await prisma.testAttempt.findUnique({ where: { id: refId }, select: { userId: true } }).catch(() => null)
    return !!a && a.userId === userId
  }
  const part = await prisma.interviewParticipant.findFirst({ where: { interviewId: refId, userId }, select: { id: true } }).catch(() => null)
  if (part) return true
  const iv = await prisma.interview.findUnique({ where: { id: refId }, select: { hostId: true } }).catch(() => null)
  return !!iv && iv.hostId === userId
}

/* Trust-boundary evidence sanitizer: only a tiny allow-list of safe metadata scalars —
 * NEVER arbitrary client JSON (which could smuggle content the guarantee forbids). */
function sanitizeEvidence(e: any): string | null {
  if (!e || typeof e !== "object") return null
  const out: Record<string, any> = {}
  if (Number.isFinite(Number(e.count))) out.count = Math.min(1e6, Math.max(0, Math.round(Number(e.count))))
  if (Number.isFinite(Number(e.durationMs))) out.durationMs = Math.min(864e5, Math.max(0, Math.round(Number(e.durationMs))))
  if (typeof e.kind === "string") out.kind = e.kind.slice(0, 40)
  return Object.keys(out).length ? JSON.stringify(out) : null
}

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

  // A candidate proctors only their OWN session (subject = caller) AND only for a
  // ref they legitimately belong to — never an arbitrary client-supplied refId.
  if (!(await ownsRef(kind, refId, p.userId))) {
    return NextResponse.json({ error: "You are not a subject of this session." }, { status: 403 })
  }
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

  // Append events — ONLY catalogued types (unknown types are dropped at the boundary),
  // severity assigned in-house, evidence reduced to an allow-listed metadata scalar set.
  let recorded = 0
  for (const e of incoming) {
    const type = String(e.type || "")
    if (!isKnownType(type)) continue
    const def = classify(type)
    const conf = typeof e.confidence === "number" ? Math.max(0, Math.min(1, e.confidence)) : 1
    await prisma.proctorEvent.create({
      data: {
        sessionId: session.id, type: def.type, source: String(e.source || "browser").slice(0, 20),
        ts: e.ts ? new Date(e.ts) : new Date(), confidence: conf, severity: def.severity,
        policyRef: def.policyRef, evidence: sanitizeEvidence(e.evidence),
      },
    }).then(() => recorded++).catch(() => {})
  }

  // Recompute the deterministic risk score from ALL of the session's events.
  const all = await prisma.proctorEvent.findMany({ where: { sessionId: session.id }, select: { type: true, confidence: true } })
  const risk = sessionRisk(all)
  await prisma.proctorSession.update({ where: { id: session.id }, data: { riskScore: risk.score } }).catch(() => {})
  // Auto-triage tracks risk up AND down, but ONLY while no human has decided — an
  // updateMany guarded on reviewedById:null is atomic (never clobbers a human decision)
  // and never becomes terminally stuck at CLEARED.
  await prisma.proctorSession.updateMany({ where: { id: session.id, reviewedById: null }, data: { reviewStatus: suggestedReview(risk.score) } }).catch(() => {})

  return NextResponse.json({ recorded, sessionId: session.id, riskScore: risk.score, band: risk.band, consent: true })
}
