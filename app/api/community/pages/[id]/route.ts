import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const page = await (prisma as any).professionalPage.findFirst({
      where: { OR: [{ id: params.id }, { userId: params.id }] },
      include: {
        user: { select: { id:true,name:true,avatar:true,headline:true,location:true,role:true,createdAt:true } },
        pageFollows: { where: { userId: payload.userId } },
        pagePosts: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            replies: {
              include: { user: { select: { id:true,name:true,avatar:true } } },
              orderBy: { createdAt: "asc" }
            }
          }
        },
        _count: { select: { pageFollows:true, pagePosts:true } }
      }
    })
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 })
    const isOwner = page.userId === payload.userId
    const isFollowing = page.pageFollows.length > 0
    return NextResponse.json({ page, isOwner, isFollowing })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}