import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const channel = await prisma.channel.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { members:true } },
        members: { where: { userId: payload.userId } },
        posts: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            user: { select:{ id:true,name:true,avatar:true } },
            replies: {
              include: { user: { select:{ id:true,name:true,avatar:true } } },
              orderBy: { createdAt: "asc" },
            },
            _count: { select: { replies:true } },
          },
        },
      },
    })
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 })
    return NextResponse.json({ channel })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}