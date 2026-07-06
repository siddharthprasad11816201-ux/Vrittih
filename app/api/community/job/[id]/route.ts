import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const community = await (prisma as any).jobCommunity.findFirst({
      where: { OR: [{ id: params.id }, { jobId: params.id }] },
      include: {
        job: { select: { id:true,title:true,company:true,location:true,type:true,industry:true } },
        members: {
          include: { user: { select: { id:true,name:true,avatar:true,headline:true,role:true } } },
          orderBy: { joinedAt: "asc" }
        },
        posts: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            user: { select: { id:true,name:true,avatar:true,headline:true } },
            replies: {
              include: { user: { select: { id:true,name:true,avatar:true,headline:true } } },
              orderBy: { createdAt: "asc" }
            },
            _count: { select: { replies: true } }
          }
        },
        _count: { select: { members: true, posts: true } }
      }
    })
    if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 })
    const isMember = community.members.some((m: any) => m.userId === payload.userId)
    return NextResponse.json({ community, isMember })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const community = await (prisma as any).jobCommunity.findFirst({
      where: { OR: [{ id: params.id }, { jobId: params.id }] }
    })
    if (!community) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const existing = await (prisma as any).jobCommunityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: payload.userId } }
    })
    if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 })
    await (prisma as any).jobCommunityMember.create({
      data: { communityId: community.id, userId: payload.userId }
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}