import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { attemptId, answers, tabSwitches } = await req.json()
    const test = await (prisma as any).test.findUnique({
      where: { id: params.id },
      include: { questions: true }
    })
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 })
    let totalPoints = 0
    let earnedPoints = 0
    const answerRecords: any[] = []
    for (const q of test.questions) {
      totalPoints += q.points
      const userAnswer = answers[q.id]
      let correct = false
      let pts = 0
      if (q.correctAnswer && userAnswer) {
        correct = userAnswer.toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase()
        if (correct) { pts = q.points; earnedPoints += pts }
      }
      answerRecords.push({ attemptId, questionId: q.id, value: userAnswer?.toString() || "", correct, points: pts })
    }
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
    const passed = score >= test.passingScore
    const attempt = await (prisma as any).testAttempt.update({
      where: { id: attemptId },
      data: {
        status: "COMPLETED",
        score,
        passed,
        completedAt: new Date(),
        tabSwitches: tabSwitches || 0,
        answers: { create: answerRecords }
      }
    })
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        title: `Test completed: ${test.title}`,
        body: `Your score: ${score}% — ${passed ? "Passed ✓" : "Not passed"}`,
        link: `/tests/${params.id}`
      }
    })
    return NextResponse.json({ success: true, score, passed, earnedPoints, totalPoints, attempt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}