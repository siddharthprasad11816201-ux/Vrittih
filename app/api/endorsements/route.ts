import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { endorsementWeight } from "@/lib/social/engage"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

// Endorsement counts for a user's skills (+ whether the caller endorsed each).
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const userId = new URL(req.url).searchParams.get("userId") || payload.userId

  const rows = await (prisma as any).skillEndorsement.findMany({ where: { userId } })
  const bySkill = new Map<string, { count: number; mine: boolean }>()
  for (const r of rows) {
    const g = bySkill.get(r.skill) || { count: 0, mine: false }
    g.count++
    if (r.endorserId === payload.userId) g.mine = true
    bySkill.set(r.skill, g)
  }
  const skills = [...bySkill.entries()]
    .map(([skill, g]) => ({ skill, count: g.count, endorsedByMe: g.mine, weight: endorsementWeight(g.count) }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill))
  return NextResponse.json({ userId, skills })
}

// Endorse a skill. Only an ACCEPTED connection may endorse, and never yourself —
// that keeps the signal meaningful instead of farmable.
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const body = await req.json()
    const userId = String(body?.userId || "")
    const skill = String(body?.skill || "").trim().slice(0, 80)
    if (!userId || !skill) return NextResponse.json({ error: "userId and skill are required" }, { status: 400 })
    if (userId === payload.userId) return NextResponse.json({ error: "You cannot endorse yourself" }, { status: 400 })

    const connected = await prisma.connection.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { userId: payload.userId, connectedId: userId },
          { userId, connectedId: payload.userId },
        ],
      },
    })
    if (!connected) return NextResponse.json({ error: "You can only endorse your connections" }, { status: 403 })

    // The skill must actually be on their profile — no endorsing skills they never claimed.
    const hasSkill = await prisma.userSkill.findFirst({ where: { userId, skill: { name: skill } } })
    if (!hasSkill) return NextResponse.json({ error: "That person does not list this skill" }, { status: 400 })

    await (prisma as any).skillEndorsement.upsert({
      where: { userId_skill_endorserId: { userId, skill, endorserId: payload.userId } },
      create: { userId, skill, endorserId: payload.userId },
      update: {},
    })
    const count = await (prisma as any).skillEndorsement.count({ where: { userId, skill } })

    await prisma.notification.create({
      data: {
        userId,
        title: "You were endorsed",
        body: `Someone in your network endorsed you for ${skill}.`,
        link: `/u/${userId}`,
      },
    })
    return NextResponse.json({ ok: true, skill, count, weight: endorsementWeight(count) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

// Withdraw an endorsement you gave.
export async function DELETE(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const url = new URL(req.url)
  const userId = url.searchParams.get("userId") || ""
  const skill = url.searchParams.get("skill") || ""
  if (!userId || !skill) return NextResponse.json({ error: "userId and skill are required" }, { status: 400 })
  await (prisma as any).skillEndorsement.deleteMany({ where: { userId, skill, endorserId: payload.userId } })
  const count = await (prisma as any).skillEndorsement.count({ where: { userId, skill } })
  return NextResponse.json({ ok: true, count })
}
