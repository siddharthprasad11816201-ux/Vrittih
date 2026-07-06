import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { conversationId, content } = await req.json()
    if (!conversationId || !content?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: payload.userId } }
    })
    if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 })
    const message = await prisma.message.create({
      data: { conversationId, senderId: payload.userId, content: content.trim() },
      include: { sender: { select: { id:true,name:true,avatar:true } } }
    })
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
    return NextResponse.json({ success: true, message }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}