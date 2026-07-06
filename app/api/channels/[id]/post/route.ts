import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: params.id, userId: payload.userId } },
    })
    if (!member) return NextResponse.json({ error: "Join channel first" }, { status: 403 })
    const { content, replyToId } = await req.json()
    if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 })
    if (replyToId) {
      const reply = await prisma.channelReply.create({
        data: { postId: replyToId, userId: payload.userId, content: content.trim() },
        include: { user: { select:{ id:true,name:true,avatar:true } } },
      })
      return NextResponse.json({ success:true, reply }, { status: 201 })
    }
    const post = await prisma.channelPost.create({
      data: { channelId: params.id, userId: payload.userId, content: content.trim() },
      include: {
        user: { select:{ id:true,name:true,avatar:true } },
        replies: { include: { user: { select:{ id:true,name:true,avatar:true } } } },
        _count: { select: { replies:true } },
      },
    })
    return NextResponse.json({ success:true, post }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}