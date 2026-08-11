import { NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/ratelimit/store"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { review, dueCards, type Grade } from "@/lib/assessment/srs"
import { awardXp, dayString, ZERO_PROGRESS } from "@/lib/gamification"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

// GET: the caller's review queue — cards due now, soonest first (Duolingo-style practice).
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const now = new Date()

  const cards = await (prisma as any).reviewItem.findMany({
    where: { userId: payload.userId, dueAt: { lte: now } },
    orderBy: { dueAt: "asc" },
    take: 30,
    include: { question: { select: { id: true, type: true, text: true, options: true, skill: true, difficulty: true, testId: true } } },
  })
  const upcoming = await (prisma as any).reviewItem.count({ where: { userId: payload.userId, dueAt: { gt: now } } })

  return NextResponse.json({
    due: cards.length,
    upcoming,
    // The correct answer is deliberately NOT sent — grading happens server-side on POST.
    cards: cards.map((c: any) => ({
      id: c.id, dueAt: c.dueAt, lastResult: c.lastResult, repetitions: c.repetitions,
      question: c.question,
    })),
  })
}

// POST: answer a review card. The server grades it, reschedules with SM-2, and awards XP.
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const rl = await rateLimit("assessment_answer", payload.userId)
    if (!rl.allowed) return NextResponse.json({ error: "Slow down a moment." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })
    const body = await req.json()
    const id = String(body?.id || "")
    const value = String(body?.value ?? "")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    // Ownership is part of the lookup, so one user can never grade another's card.
    const card = await (prisma as any).reviewItem.findFirst({
      where: { id, userId: payload.userId },
      include: { question: { select: { id: true, correctAnswer: true, difficulty: true } } },
    })
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 })

    const expected = card.question?.correctAnswer
    if (expected == null || String(expected).trim() === "") {
      return NextResponse.json({ error: "This question cannot be auto-graded" }, { status: 400 })
    }
    const correct = value.trim().toLowerCase() === String(expected).trim().toLowerCase()

    // Grade explicitly from the real outcome — never inferred from a client claim.
    const grade: Grade = correct ? (card.question.difficulty >= 4 ? 5 : 4) : 2
    const now = new Date()
    const next = review({ repetitions: card.repetitions, intervalDays: card.intervalDays, ease: card.ease }, grade, now)

    await (prisma as any).reviewItem.update({
      where: { id: card.id },
      data: { repetitions: next.repetitions, intervalDays: next.intervalDays, ease: next.ease, dueAt: next.dueAt, lastResult: correct ? "correct" : "wrong" },
    })

    // Small XP for practice — enough to build the daily habit, never enough to rival a real test.
    let xpAwarded = 0, streakDays = 0, level = 1
    try {
      const p = await (prisma as any).userProgress.findUnique({ where: { userId: payload.userId } })
      const state = p
        ? { xp: p.xp, level: p.level, streakDays: p.streakDays, longestStreak: p.longestStreak, freezes: p.freezes, lastActiveDay: p.lastActiveDay }
        : { ...ZERO_PROGRESS }
      const res = awardXp(state, correct ? 5 : 2, dayString(now))
      await (prisma as any).userProgress.upsert({
        where: { userId: payload.userId },
        create: { userId: payload.userId, xp: res.state.xp, level: res.state.level, streakDays: res.state.streakDays, longestStreak: res.state.longestStreak, freezes: res.state.freezes, lastActiveDay: res.state.lastActiveDay },
        update: { xp: res.state.xp, level: res.state.level, streakDays: res.state.streakDays, longestStreak: res.state.longestStreak, freezes: res.state.freezes, lastActiveDay: res.state.lastActiveDay },
      })
      await (prisma as any).xpEvent.create({ data: { userId: payload.userId, amount: res.xpAwarded, reason: "review" } })
      xpAwarded = res.xpAwarded; streakDays = res.state.streakDays; level = res.state.level
    } catch { /* XP is additive — never fail the review on it */ }

    return NextResponse.json({ correct, nextDueAt: next.dueAt, intervalDays: next.intervalDays, xpAwarded, streakDays, level })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
