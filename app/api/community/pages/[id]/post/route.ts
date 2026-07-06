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
    const page = await (prisma as any).professionalPage.findUnique({ where: { id: params.id } })
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 })
    if (replyToId) {
      const reply = await (prisma as any).pagePostReply.create({
        data: { postId: replyToId, userId: payload.userId, content: content.trim() },
        include: { user: { select: { id:true,name:true,avatar:true } } }
      })
      return NextResponse.json({ success: true, reply }, { status: 201 })
    }
    if (page.userId !== payload.userId) {
      return NextResponse.json({ error: "Only page owner can post" }, { status: 403 })
    }
    const post = await (prisma as any).pagePost.create({
      data: { pageId: params.id, content: content.trim() },
      include: { replies: { include: { user: { select:{ id:true,name:true,avatar:true } } } } }
    })
    return NextResponse.json({ success: true, post }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}