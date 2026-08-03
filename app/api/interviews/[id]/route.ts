import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { mayView, mayJoin, maySeeConfidential } from "@/lib/interview/governance"

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

    const isAdmin = payload.role === "ADMIN" || payload.role === "SUPER_ADMIN"
    const attendeeIds: string[] = (interview.participants || []).map((pp: any) => pp.userId)

    // COMPANY visibility: resolve which host ids share a company with the viewer.
    let viewerCompanyHostIds: string[] = []
    if ((interview.visibility || "").toUpperCase() === "COMPANY" && !isAdmin) {
      const myCos = await prisma.company.findMany({ where: { ownerId: payload.userId }, select: { name: true } })
      const names = myCos.map(c => c.name)
      if (names.length) {
        const peers = await prisma.company.findMany({ where: { name: { in: names } }, select: { ownerId: true } })
        viewerCompanyHostIds = peers.map(p => p.ownerId).filter(Boolean) as string[]
      }
    }

    // Governance: who may VIEW at all. Notes, recordingUrl and the roomCode (the
    // join credential) must not leak to anyone the visibility rule excludes.
    const canView = mayView({
      viewerId: payload.userId, isAdmin, hostId: interview.hostId,
      visibility: interview.visibility, attendeeIds, viewerCompanyHostIds,
    })
    if (!canView) return NextResponse.json({ error: "Interview not found" }, { status: 404 })

    // The viewer's role in this interview drives confidential material access.
    const myRole = interview.hostId === payload.userId ? "HOST"
      : (interview.participants || []).find((pp: any) => pp.userId === payload.userId)?.role || (isAdmin ? "HOST" : "OBSERVER")
    const join = mayJoin({ viewerId: payload.userId, isAdmin, hostId: interview.hostId, visibility: interview.visibility, attendeeIds })

    // Redact confidential notes/recording from observers & candidates.
    if (!maySeeConfidential(myRole, !!interview.confidential)) {
      interview.notes = null
      interview.recordingUrl = null
    }
    let governance: any = null
    try { governance = interview.govJson ? JSON.parse(interview.govJson) : null } catch {}

    return NextResponse.json({ interview: { ...interview, govJson: undefined }, myRole, canJoin: join.allowed, joinReason: join.reason, governance })
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