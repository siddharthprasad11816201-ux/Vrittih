import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const existing = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: params.id, userId: payload.userId } },
    })
    if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 })
    await prisma.channelMember.create({ data: { channelId: params.id, userId: payload.userId } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}