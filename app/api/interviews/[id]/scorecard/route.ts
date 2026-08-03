import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { ASSESSING_ROLES } from "@/lib/interview/governance"
import { aggregatePanel, RECOMMENDATIONS, DEFAULT_COMPETENCIES, type Scorecard } from "@/lib/interview/scorecard"

export const dynamic = "force-dynamic"

/* EROS Module 6 — interview scorecards. A panelist (assessing participant) submits one
 * structured, competency-based evaluation; the panel roll-up + bias signals come from
 * lib/interview/scorecard.ts. Candidates never see scorecards. */

async function loadInterview(idOrCode: string) {
  return prisma.interview.findFirst({
    where: { OR: [{ id: idOrCode }, { roomCode: idOrCode }] },
    include: { participants: { include: { user: { select: { id: true, name: true } } } } },
  })
}
function myRole(iv: any, userId: string): string | null {
  if (iv.hostId === userId) return "HOST"
  return (iv.participants || []).find((p: any) => p.userId === userId)?.role || null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const iv = await loadInterview(params.id)
  if (!iv) return NextResponse.json({ error: "Interview not found" }, { status: 404 })

  const isAdmin = p.role === "ADMIN" || p.role === "SUPER_ADMIN"
  const role = myRole(iv, p.userId)
  const canAssess = isAdmin || (role != null && ASSESSING_ROLES.includes(role.toUpperCase() as any))
  if (!canAssess) return NextResponse.json({ error: "Only an interviewer on this panel can submit a scorecard." }, { status: 403 })

  const b = await req.json()
  const recommendation = String(b.recommendation || "").toUpperCase()
  if (!(RECOMMENDATIONS as readonly string[]).includes(recommendation)) {
    return NextResponse.json({ error: "A valid recommendation is required." }, { status: 400 })
  }
  // Sanitise ratings to 1..4 integers keyed by known competencies (+ any custom keys).
  const rawRatings = (b.ratings && typeof b.ratings === "object") ? b.ratings : {}
  const ratings: Record<string, number> = {}
  for (const [k, v] of Object.entries(rawRatings)) {
    const n = Math.round(Number(v))
    if (Number.isFinite(n) && n >= 1 && n <= 4) ratings[String(k).slice(0, 40)] = n
  }
  if (!Object.keys(ratings).length) return NextResponse.json({ error: "At least one competency rating is required." }, { status: 400 })

  const data = {
    interviewId: iv.id, applicationId: iv.applicationId || null, panelistId: p.userId,
    competencySet: String(b.competencySet || "default").slice(0, 40),
    ratingsJson: JSON.stringify(ratings), recommendation,
    notes: b.notes ? String(b.notes).slice(0, 8000) : null,
  }
  const card = await prisma.interviewScorecard.upsert({
    where: { interviewId_panelistId: { interviewId: iv.id, panelistId: p.userId } },
    create: data, update: { ratingsJson: data.ratingsJson, recommendation, notes: data.notes, competencySet: data.competencySet },
  })
  return NextResponse.json({ success: true, scorecardId: card.id })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const iv = await loadInterview(params.id)
  if (!iv) return NextResponse.json({ error: "Interview not found" }, { status: 404 })

  const isAdmin = p.role === "ADMIN" || p.role === "SUPER_ADMIN"
  const role = myRole(iv, p.userId)
  const isAssessor = isAdmin || (role != null && ASSESSING_ROLES.includes(role.toUpperCase() as any))
  // Candidates and observers never see evaluations.
  if (!isAssessor) return NextResponse.json({ error: "Not authorized to view scorecards." }, { status: 403 })

  const rows = await prisma.interviewScorecard.findMany({
    where: { interviewId: iv.id },
    include: { panelist: { select: { id: true, name: true } } },
    orderBy: { submittedAt: "asc" },
  })
  const cards: Scorecard[] = rows.map(r => ({
    panelistId: r.panelistId, panelistName: r.panelist?.name || undefined,
    ratings: (() => { try { return JSON.parse(r.ratingsJson) } catch { return {} } })(),
    recommendation: r.recommendation as any, notes: r.notes || undefined,
  }))
  const panel = cards.length ? aggregatePanel(cards) : null
  const mine = rows.find(r => r.panelistId === p.userId)
  return NextResponse.json({
    competencies: DEFAULT_COMPETENCIES,
    myScorecard: mine ? { ratings: JSON.parse(mine.ratingsJson), recommendation: mine.recommendation, notes: mine.notes } : null,
    scorecards: cards.map(c => ({ panelistId: c.panelistId, panelistName: c.panelistName, recommendation: c.recommendation, ratings: c.ratings, notes: c.notes })),
    panel,
    canManage: iv.hostId === p.userId || isAdmin,
  })
}
