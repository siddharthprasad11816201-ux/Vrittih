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
    // Only the host or an invited participant may see it — notes, recordingUrl and
    // the roomCode (the join credential) must not leak to anyone with the id/code.
    const isMember = interview.hostId === payload.userId || (interview.participants || []).some((pp: any) => pp.userId === payload.userId)
    const isAdmin = payload.role === "ADMIN" || payload.role === "SUPER_ADMIN"
    if (!isMember && !isAdmin) return NextResponse.json({ error: "Interview not found" }, { status: 404 })
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