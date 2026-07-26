import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { hasFeature } from "@/lib/entitlements"
import crypto from "crypto"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const interviews = await (prisma as any).interview.findMany({
      where: {
        OR: [
          { hostId: payload.userId },
          { participants: { some: { userId: payload.userId } } },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        host: { select: { id:true,name:true,avatar:true } },
        participants: { include: { user: { select: { id:true,name:true,avatar:true } } } },
      },
    })
    return NextResponse.json({ interviews })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })

    // Video interviews are enterprise-only (max employer tier). Enforce server-side —
    // hiding the nav is not a control. Hosts must be entitled; invited candidates
    // still join a specific room via its link (that path is not gated here).
    const host = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true, plan: true } })
    if (!hasFeature(host, "interviews")) {
      return NextResponse.json({ error: "Video interviews are available on the Scale plan.", upgrade: "emp_scale" }, { status: 403 })
    }

    const { title, type, scheduledAt, duration, participantIds, applicationId, notes } = await req.json()
    if (!title || !scheduledAt) return NextResponse.json({ error: "Title and scheduled time required" }, { status: 400 })
    const roomCode = crypto.randomBytes(4).toString("hex").toUpperCase()
    const interview = await (prisma as any).interview.create({
      data: {
        title, type: type||"ONE_ON_ONE",
        scheduledAt: new Date(scheduledAt),
        duration: duration||60,
        hostId: payload.userId,
        applicationId: applicationId||null,
        roomCode, notes: notes||null,
        participants: {
          create: [
            { userId: payload.userId, role: "HOST" },
            ...(participantIds||[]).map((uid: string) => ({ userId: uid, role: "CANDIDATE" })),
          ],
        },
      },
      include: {
        host: { select:{ id:true,name:true,email:true } },
        participants: { include:{ user:{ select:{ id:true,name:true,email:true } } } },
      },
    })
    // Notify participants
    for (const p of interview.participants) {
      if (p.userId !== payload.userId) {
        await prisma.notification.create({
          data: {
            userId: p.userId,
            title: `Interview scheduled: ${title}`,
            body: `Scheduled for ${new Date(scheduledAt).toLocaleString("en-IN")}. Room code: ${roomCode}`,
            link: `/interviews/${roomCode}`,
          },
        })
      }
    }
    return NextResponse.json({ success:true, interview }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}