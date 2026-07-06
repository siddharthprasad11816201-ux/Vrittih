import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const existing = await (prisma as any).professionalSpaceMember.findUnique({
      where: { spaceId_userId: { spaceId: params.id, userId: payload.userId } }
    })
    if (existing) {
      await (prisma as any).professionalSpaceMember.delete({
        where: { spaceId_userId: { spaceId: params.id, userId: payload.userId } }
      })
      return NextResponse.json({ success: true, joined: false })
    }
    await (prisma as any).professionalSpaceMember.create({
      data: { spaceId: params.id, userId: payload.userId }
    })
    return NextResponse.json({ success: true, joined: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}