import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const interview = await (prisma as any).interview.findFirst({
      where: {
        OR: [{ id: params.id },{ roomCode: params.id }],
      },
      include: {
        host: { select:{ id:true,name:true,avatar:true } },
        participants: { include:{ user:{ select:{ id:true,name:true,avatar:true,headline:true } } } },
      },
    })
    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 })
    return NextResponse.json({ interview })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { status, notes, recordingUrl } = await req.json()
    const interview = await (prisma as any).interview.updateMany({
      where: { id: params.id, hostId: payload.userId },
      data: { status, notes, recordingUrl },
    })
    return NextResponse.json({ success:true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}