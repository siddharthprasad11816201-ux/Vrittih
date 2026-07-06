import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const space = await (prisma as any).professionalSpace.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }] },
      include: {
        _count: { select: { members: true } },
        members: {
          include: { user: { select: { id:true,name:true,avatar:true,headline:true,role:true } } },
          orderBy: { joinedAt: "asc" },
          take: 20
        },
        posts: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            user: { select: { id:true,name:true,avatar:true,headline:true,role:true } },
            replies: {
              include: { user: { select: { id:true,name:true,avatar:true,headline:true } } },
              orderBy: { createdAt: "asc" }
            },
            _count: { select: { replies: true } }
          }
        }
      }
    })
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 })
    const isMember = space.members.some((m: any) => m.userId === payload.userId)
    return NextResponse.json({ space, isMember })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}