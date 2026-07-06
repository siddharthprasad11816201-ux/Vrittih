import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const existing = await prisma.connection.findMany({
      where: { OR:[{ userId:payload.userId },{ connectedId:payload.userId }] },
      select: { userId:true, connectedId:true },
    })
    const excluded = new Set([payload.userId, ...existing.map(c => c.userId), ...existing.map(c => c.connectedId)])
    const suggestions = await prisma.user.findMany({
      where: { id: { notIn: Array.from(excluded) }, paid: true },
      select: { id:true,name:true,avatar:true,headline:true,location:true,role:true },
      take: 20,
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ suggestions })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}