import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { hasFeature } from "@/lib/entitlements"
import { evaluatePanel, VISIBILITY, ATTENDEE_ROLES, type Attendee } from "@/lib/interview/governance"
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

    const body = await req.json()
    const { title, type, scheduledAt, duration, participantIds, applicationId, notes } = body
    const roleLevel: string | null = body.roleLevel || null
    const visibility: string = VISIBILITY.includes((body.visibility || "").toUpperCase()) ? body.visibility.toUpperCase() : "PARTICIPANTS"
    const confidential = !!body.confidential
    const requestedOverride = !!body.override
    if (!title || !scheduledAt) return NextResponse.json({ error: "Title and scheduled time required" }, { status: 400 })

    // Assemble the panel: prefer a rich `attendees:[{userId,role}]`, else fall
    // back to participantIds (all treated as candidates). The host is HOST.
    const rawAttendees: { userId: string; role: string }[] = Array.isArray(body.attendees) && body.attendees.length
      ? body.attendees
          .filter((a: any) => a && a.userId && a.userId !== payload.userId)
          .map((a: any) => ({ userId: String(a.userId), role: (ATTENDEE_ROLES as readonly string[]).includes(String(a.role || "").toUpperCase()) ? String(a.role).toUpperCase() : "CANDIDATE" }))
      : (participantIds || []).filter((u: string) => u !== payload.userId).map((u: string) => ({ userId: String(u), role: "CANDIDATE" }))

    // Look up seniority for the host + every attendee to score the panel.
    const ids = Array.from(new Set([payload.userId, ...rawAttendees.map(a => a.userId)]))
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true, seniority: true } })
    const uMap = new Map(users.map(u => [u.id, u]))
    const hostUser = uMap.get(payload.userId)

    const attendeesForEval: Attendee[] = [
      { userId: payload.userId, name: hostUser?.name, role: "HOST", seniority: hostUser?.seniority },
      ...rawAttendees.map(a => ({ userId: a.userId, name: uMap.get(a.userId)?.name, role: a.role, seniority: uMap.get(a.userId)?.seniority })),
    ]

    // Only an authorized approver may override a governance violation.
    const canOverride = requestedOverride && (hostUser?.role === "ADMIN" || hostUser?.role === "SUPER_ADMIN" || (hostUser?.seniority || "").toUpperCase() === "EXECUTIVE")
    const gov = evaluatePanel({ roleLevel, attendees: attendeesForEval, override: canOverride })
    if (!gov.ok) {
      return NextResponse.json({ error: gov.violations[0], governance: gov, needsOverride: requestedOverride && !canOverride }, { status: 422 })
    }

    const roomCode = crypto.randomBytes(4).toString("hex").toUpperCase()
    const interview = await (prisma as any).interview.create({
      data: {
        title, type: type||"ONE_ON_ONE",
        scheduledAt: new Date(scheduledAt),
        duration: duration||60,
        hostId: payload.userId,
        applicationId: applicationId||null,
        roomCode, notes: notes||null,
        visibility, roleLevel: roleLevel || null, confidential,
        govJson: JSON.stringify({ ...gov, overriddenBy: canOverride ? payload.userId : null, at: new Date().toISOString() }),
        participants: {
          create: [
            { userId: payload.userId, role: "HOST" },
            ...rawAttendees.map(a => ({ userId: a.userId, role: a.role })),
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