import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const convos = await prisma.conversation.findMany({
      where: { participants: { some: { userId: payload.userId } } },
      orderBy: { updatedAt: "desc" },
      include: {
        participants: { include: { user: { select: { id: true, name: true, avatar: true, headline: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    })
    return NextResponse.json({ conversations: convos })
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
    const { recipientId } = await req.json()
    if (!recipientId) return NextResponse.json({ error: "Recipient required" }, { status: 400 })
    if (recipientId === payload.userId) return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 })
    const existing = await prisma.conversation.findFirst({
      where: {
        participants: { every: { userId: { in: [payload.userId, recipientId] } } },
        AND: [
          { participants: { some: { userId: payload.userId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      include: { participants: true },
    })
    if (existing && existing.participants.length === 2) {
      return NextResponse.json({ conversation: existing })
    }
    const convo = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: payload.userId }, { userId: recipientId }],
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      },
    })
    return NextResponse.json({ conversation: convo }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}