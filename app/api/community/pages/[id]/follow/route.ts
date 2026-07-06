import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const existing = await (prisma as any).pageFollow.findUnique({
      where: { pageId_userId: { pageId: params.id, userId: payload.userId } }
    })
    if (existing) {
      await (prisma as any).pageFollow.delete({
        where: { pageId_userId: { pageId: params.id, userId: payload.userId } }
      })
      await (prisma as any).professionalPage.update({
        where: { id: params.id }, data: { followers: { decrement: 1 } }
      })
      return NextResponse.json({ success: true, following: false })
    }
    await (prisma as any).pageFollow.create({
      data: { pageId: params.id, userId: payload.userId }
    })
    await (prisma as any).professionalPage.update({
      where: { id: params.id }, data: { followers: { increment: 1 } }
    })
    return NextResponse.json({ success: true, following: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}