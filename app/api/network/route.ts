import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const [sent, received, accepted] = await Promise.all([
      prisma.connection.findMany({
        where: { userId: payload.userId },
        include: { connected: { select: { id:true,name:true,avatar:true,headline:true,location:true,role:true } } },
      }),
      prisma.connection.findMany({
        where: { connectedId: payload.userId },
        include: { user: { select: { id:true,name:true,avatar:true,headline:true,location:true,role:true } } },
      }),
      prisma.connection.findMany({
        where: { OR:[{ userId:payload.userId },{ connectedId:payload.userId }], status:"ACCEPTED" },
        include: {
          user: { select:{ id:true,name:true,avatar:true,headline:true,location:true } },
          connected: { select:{ id:true,name:true,avatar:true,headline:true,location:true } },
        },
      }),
    ])
    return NextResponse.json({ sent, received, connections: accepted })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}