import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { content, replyToId } = await req.json()
    if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 })
    const community = await (prisma as any).jobCommunity.findFirst({
      where: { OR: [{ id: params.id }, { jobId: params.id }] }
    })
    if (!community) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (replyToId) {
      const reply = await (prisma as any).jobCommunityReply.create({
        data: { postId: replyToId, userId: payload.userId, content: content.trim() },
        include: { user: { select: { id:true,name:true,avatar:true,headline:true } } }
      })
      return NextResponse.json({ success: true, reply }, { status: 201 })
    }
    const post = await (prisma as any).jobCommunityPost.create({
      data: { communityId: community.id, userId: payload.userId, content: content.trim() },
      include: {
        user: { select: { id:true,name:true,avatar:true,headline:true } },
        replies: { include: { user: { select: { id:true,name:true,avatar:true } } } },
        _count: { select: { replies: true } }
      }
    })
    return NextResponse.json({ success: true, post }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}