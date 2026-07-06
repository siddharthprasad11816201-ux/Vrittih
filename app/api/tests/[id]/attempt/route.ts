import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const existing = await (prisma as any).testAttempt.findFirst({
      where: { testId: params.id, userId: payload.userId, status: "IN_PROGRESS" }
    })
    if (existing) return NextResponse.json({ attempt: existing })
    const attempt = await (prisma as any).testAttempt.create({
      data: { testId: params.id, userId: payload.userId, status: "IN_PROGRESS" }
    })
    return NextResponse.json({ attempt }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}