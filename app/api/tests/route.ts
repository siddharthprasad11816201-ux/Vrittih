import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId")
    const where: any = { active: true }
    if (jobId) where.jobId = jobId
    const tests = await (prisma as any).test.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id:true,name:true } },
        _count: { select: { questions:true, attempts:true } }
      }
    })
    return NextResponse.json({ tests })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    if (!["EMPLOYER","ADMIN","SUPER_ADMIN"].includes(payload.role)) {
      return NextResponse.json({ error: "Only employers can create tests" }, { status: 403 })
    }
    const { title, description, type, duration, passingScore, jobId, questions } = await req.json()
    if (!title || !type || !questions?.length) {
      return NextResponse.json({ error: "Title, type, and at least one question required" }, { status: 400 })
    }
    const test = await (prisma as any).test.create({
      data: {
        title, description, type, duration: duration||60,
        passingScore: passingScore||70,
        createdById: payload.userId,
        jobId: jobId||null,
        questions: {
          create: questions.map((q: any, i: number) => ({
            type: q.type,
            text: q.text,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer || null,
            points: q.points || 10,
            order: i
          }))
        }
      },
      include: { questions: true, _count: { select: { questions:true } } }
    })
    return NextResponse.json({ success: true, test }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}