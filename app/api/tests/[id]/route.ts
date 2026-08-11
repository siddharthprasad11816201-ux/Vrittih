import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { prepareQuestions } from "@/lib/assessment/integrity"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const test = await (prisma as any).test.findUnique({
      where: { id: params.id },
      include: {
        questions: { orderBy: { order: "asc" }, select: { id:true,type:true,text:true,options:true,points:true,order:true,skill:true,difficulty:true } },
        _count: { select: { questions:true, attempts:true } }
      }
    })
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 })

    // Per-attempt randomization (anti-cheat). Seeded by the caller's OPEN attempt id, so the
    // order is stable across refreshes for this candidate but differs between candidates.
    // Falls back to the authored order when the test has shuffling off or no attempt is open.
    if (test.shuffleQuestions || test.shuffleOptions || test.sampleN) {
      const attempt = await (prisma as any).testAttempt.findFirst({
        where: { testId: params.id, userId: payload.userId, status: "IN_PROGRESS" },
        select: { id: true },
      })
      if (attempt) {
        const parsed = test.questions.map((q: any) => {
          let options: string[] | null = null
          try { options = q.options ? JSON.parse(q.options) : null } catch { options = null }
          return { ...q, options }
        })
        const prepared = prepareQuestions(parsed, attempt.id, {
          shuffleQuestions: test.shuffleQuestions,
          shuffleOptions: test.shuffleOptions,
          sampleN: test.sampleN,
        })
        // Re-serialize options so the response shape is unchanged for the client.
        test.questions = prepared.map((q: any) => ({ ...q, options: q.options ? JSON.stringify(q.options) : null }))
      }
    }

    return NextResponse.json({ test })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
