import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { skillScores, type GradedAnswer } from "@/lib/assessment/skillScore"
import { proficiencyFromEvidence, proficiencyBand } from "@/lib/learning/competency"
import { awardXp, testXp, dayString, ZERO_PROGRESS } from "@/lib/gamification"
import { checkTiming } from "@/lib/assessment/integrity"
import { review, gradeFromAnswer, NEW_CARD } from "@/lib/assessment/srs"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { attemptId, answers, tabSwitches } = await req.json()
    if (!attemptId || typeof attemptId !== "string") return NextResponse.json({ error: "attemptId is required" }, { status: 400 })
    const test = await (prisma as any).test.findUnique({
      where: { id: params.id },
      include: { questions: true }
    })
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 })

    // SERVER-side time enforcement — the client timer is advisory only. A late submit is
    // rejected here rather than silently accepted (the attempt stays open for review).
    const openAttempt = await (prisma as any).testAttempt.findFirst({
      where: { id: attemptId, userId: payload.userId, testId: params.id, status: "IN_PROGRESS" },
      select: { startedAt: true },
    })
    if (openAttempt) {
      const timing = checkTiming(openAttempt.startedAt, test.duration, new Date())
      if (timing.expired) {
        await (prisma as any).testAttempt.updateMany({
          where: { id: attemptId, userId: payload.userId, testId: params.id, status: "IN_PROGRESS" },
          data: { status: "EXPIRED", completedAt: new Date() },
        })
        return NextResponse.json({ error: "Time limit exceeded — this attempt has expired.", ...timing }, { status: 400 })
      }
    }

    let totalPoints = 0
    let earnedPoints = 0
    let correctCount = 0
    const answerRecords: any[] = []
    const graded: GradedAnswer[] = []   // per-question, for the assessment -> skill pipeline
    for (const q of test.questions) {
      const userAnswer = answers[q.id]
      const autoScorable = q.correctAnswer != null && String(q.correctAnswer).trim() !== ""
      if (!autoScorable) {
        // The creator left the expected answer blank ("Leave blank for manual
        // review"): this SHORT/CODING question can't be auto-graded, so it must NOT
        // count against the candidate. Keep it out of the auto-scored denominator
        // and mark the answer pending review (correct: null), never wrong.
        answerRecords.push({ attemptId, questionId: q.id, value: userAnswer?.toString() || "", correct: null, points: 0 })
        graded.push({ skill: q.skill, possible: 0, earned: 0, graded: false, difficulty: q.difficulty })
        continue
      }
      totalPoints += q.points
      let correct = false
      let pts = 0
      if (userAnswer) {
        correct = userAnswer.toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase()
        if (correct) { pts = q.points; earnedPoints += pts; correctCount++ }
      }
      answerRecords.push({ attemptId, questionId: q.id, value: userAnswer?.toString() || "", correct, points: pts })
      graded.push({ skill: q.skill, possible: q.points, earned: pts, graded: true, difficulty: q.difficulty })
    }
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
    const passed = score >= test.passingScore
    // Atomic, status-conditional flip scoped to the caller + this test + an OPEN
    // attempt. Putting userId/testId/status in the WHERE of the UPDATE itself
    // (not a separate read-then-write) closes both the cross-candidate IDOR and
    // a self-race: two concurrent submits of the same attempt can't both match.
    const flip = await (prisma as any).testAttempt.updateMany({
      where: { id: attemptId, userId: payload.userId, testId: params.id, status: "IN_PROGRESS" },
      data: {
        status: "COMPLETED",
        score,
        passed,
        completedAt: new Date(),
        tabSwitches: tabSwitches || 0
      }
    })
    if (flip.count === 0) return NextResponse.json({ error: "Attempt not found or already submitted" }, { status: 404 })
    await (prisma as any).answer.createMany({ data: answerRecords })
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        title: `Test completed: ${test.title}`,
        body: `Your score: ${score}% — ${passed ? "Passed ✓" : "Not passed"}`,
        link: `/tests/${params.id}`
      }
    })

    // ---- EduRankAI enrichment (best-effort; the score above is already persisted) ----
    // The atomic flip guarantees this runs at most once per attempt, so XP can't be farmed
    // by re-submitting. Any failure here must NOT fail the submit, so it's isolated.
    const userId = payload.userId
    let verified: { skill: string; score: number; proctored: boolean }[] = []
    let xpAwarded = 0, level = 1, streakDays = 0, leveledUp = false
    try {
      const attempt = await (prisma as any).testAttempt.findUnique({ where: { id: attemptId }, select: { proctored: true } })
      const proctored = !!attempt?.proctored
      const perSkill = skillScores(graded)

      // 1) Verified skills: keep the BEST score per (user, skill). Feeds the ranking boost.
      for (const s of perSkill) {
        const existing = await (prisma as any).skillAssessment.findUnique({ where: { userId_skill: { userId, skill: s.skill } } })
        const prev = existing?.score ?? 0
        const isBest = s.score >= prev
        await (prisma as any).skillAssessment.upsert({
          where: { userId_skill: { userId, skill: s.skill } },
          create: { userId, skill: s.skill, score: s.score, proctored, difficulty: s.difficulty, attemptId, testId: params.id },
          update: {
            score: Math.max(prev, s.score),
            proctored: isBest ? proctored : (existing?.proctored ?? proctored),
            difficulty: Math.max(existing?.difficulty ?? 1, s.difficulty),
            attemptId, testId: params.id, takenAt: new Date(),
          },
        })

        // 2) Feed competency evidence — this is the .45 "assessment" weight that received
        // nothing before. Merge the best assessment score into the evidence and recompute.
        const sp = await prisma.skillProficiency.findUnique({ where: { userId_skill: { userId, skill: s.skill } } })
        let evidence: Record<string, number> = {}
        try { evidence = sp?.evidence ? JSON.parse(sp.evidence) : {} } catch { evidence = {} }
        evidence.assessment = Math.max(typeof evidence.assessment === "number" ? evidence.assessment : 0, s.score)
        const confidence = proficiencyFromEvidence(Object.entries(evidence).map(([source, sc]) => ({ source, score: typeof sc === "number" ? sc : undefined })))
        await prisma.skillProficiency.upsert({
          where: { userId_skill: { userId, skill: s.skill } },
          create: { userId, skill: s.skill, confidence, level: proficiencyBand(confidence), implied: false, evidence: JSON.stringify(evidence) },
          update: { confidence, level: proficiencyBand(confidence), implied: false, evidence: JSON.stringify(evidence) },
        })

        verified.push({ skill: s.skill, score: s.score, proctored })
      }

      // 3) Gamification (XP / streak / level) — deterministic, pure math in lib/gamification.
      const p = await (prisma as any).userProgress.findUnique({ where: { userId } })
      const state = p
        ? { xp: p.xp, level: p.level, streakDays: p.streakDays, longestStreak: p.longestStreak, freezes: p.freezes, lastActiveDay: p.lastActiveDay }
        : { ...ZERO_PROGRESS }
      const res = awardXp(state, testXp({ passed, scorePct: score, correctCount, proctored }), dayString())
      await (prisma as any).userProgress.upsert({
        where: { userId },
        create: { userId, xp: res.state.xp, level: res.state.level, streakDays: res.state.streakDays, longestStreak: res.state.longestStreak, freezes: res.state.freezes, lastActiveDay: res.state.lastActiveDay },
        update: { xp: res.state.xp, level: res.state.level, streakDays: res.state.streakDays, longestStreak: res.state.longestStreak, freezes: res.state.freezes, lastActiveDay: res.state.lastActiveDay },
      })
      await (prisma as any).xpEvent.create({ data: { userId, amount: res.xpAwarded, reason: `test:${params.id}` } })
      xpAwarded = res.xpAwarded; level = res.state.level; streakDays = res.state.streakDays; leveledUp = res.leveledUp
    } catch (e) {
      // Swallow: enrichment is additive; the graded result is already saved and returned.
    }

    return NextResponse.json({ success: true, score, passed, earnedPoints, totalPoints, verified, gamification: { xpAwarded, level, streakDays, leveledUp } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}