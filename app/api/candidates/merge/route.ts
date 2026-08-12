import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { compareCandidates, mergeCandidates, revertMerge, findDuplicates, type CandidateRecord } from "@/lib/candidate/resolve"
import { logAction } from "@/lib/admin"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

const canMerge = (role: string) => ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(role)

function toRecord(row: any): CandidateRecord {
  return {
    id: row.id, name: row.displayName, location: row.location, currentEmployer: row.currentEmployer,
    identities: (row.identities || []).map((i: any) => ({ kind: i.kind, value: i.value, verified: i.verified })),
  }
}

/**
 * The duplicate REVIEW QUEUE (§53). Shows likely duplicates with the evidence behind each
 * suggestion, so a human decides. Matching names alone will never appear here — the
 * scorer caps name corroboration below the review threshold.
 */
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canMerge(payload.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const candidateId = url.searchParams.get("candidateId")

  if (candidateId) {
    const subject = await (prisma as any).candidate.findUnique({ where: { id: candidateId }, include: { identities: true } })
    if (!subject) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    const tokens = String(subject.displayName || "").toLowerCase().split(/\s+/).filter((t: string) => t.length >= 3).slice(0, 4)
    const pool = await (prisma as any).candidate.findMany({
      where: {
        mergedIntoId: null,
        id: { not: candidateId },
        OR: [
          { identities: { some: { value: { in: subject.identities.map((i: any) => i.value) } } } },
          ...tokens.map((t: string) => ({ displayName: { contains: t } })),
        ],
      },
      include: { identities: true },
      take: 50,
    })
    const dups = findDuplicates(toRecord(subject), pool.map(toRecord))
    return NextResponse.json({
      candidateId,
      duplicates: dups.map((d) => ({
        candidateId: d.candidate.id, name: d.candidate.name,
        verdict: d.match.verdict, confidence: d.match.confidence,
        reason: d.match.reviewReason, evidence: d.match.evidence,
      })),
    })
  }

  // Recent merges, for audit.
  const merges = await (prisma as any).candidateMerge.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
  return NextResponse.json({ merges })
}

/** Execute a human-approved merge. */
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canMerge(payload.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const body = await req.json()
    const survivorId = String(body?.survivorId || "")
    const mergedId = String(body?.mergedId || "")
    if (!survivorId || !mergedId) return NextResponse.json({ error: "survivorId and mergedId are required." }, { status: 400 })

    const [a, b] = await Promise.all([
      (prisma as any).candidate.findUnique({ where: { id: survivorId }, include: { identities: true } }),
      (prisma as any).candidate.findUnique({ where: { id: mergedId }, include: { identities: true } }),
    ])
    if (!a || !b) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })

    // Re-score at merge time and REFUSE an unjustifiable merge, even from an operator:
    // fusing two strangers' hiring histories is a privacy incident, not a data cleanup.
    const match = compareCandidates(toRecord(a), toRecord(b))
    if (match.verdict === "DIFFERENT" && !body?.force) {
      return NextResponse.json({
        error: "These records do not look like the same person. Re-check the evidence, or resubmit with force:true to override.",
        confidence: match.confidence, evidence: match.evidence,
      }, { status: 409 })
    }

    const res = await mergeCandidates({
      survivorId, mergedId,
      confidence: match.confidence,
      evidence: match.evidence,
      decidedById: payload.userId,
      automatic: false,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 })

    await logAction(payload.userId, "candidate.merge", { survivorId, mergedId, confidence: match.confidence, forced: !!body?.force }, req)
    return NextResponse.json({ ok: true, mergeId: res.mergeId, confidence: match.confidence, evidence: match.evidence })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

/** Undo a merge. A wrong merge must be reversible, not permanent. */
export async function DELETE(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canMerge(payload.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const mergeId = new URL(req.url).searchParams.get("mergeId") || ""
  if (!mergeId) return NextResponse.json({ error: "mergeId is required" }, { status: 400 })
  const res = await revertMerge(mergeId, payload.userId)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 })
  await logAction(payload.userId, "candidate.merge.revert", { mergeId }, req)
  return NextResponse.json({ ok: true })
}
