import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

// Who the caller has blocked.
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const rows = await (prisma as any).userBlock.findMany({ where: { blockerId: payload.userId } })
  const users = rows.length
    ? await prisma.user.findMany({ where: { id: { in: rows.map((r: any) => r.blockedId) } }, select: { id: true, name: true, avatar: true, headline: true } })
    : []
  return NextResponse.json({ blocked: users })
}

// Block a user. Blocking also withdraws any connection between the two.
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const { userId } = await req.json()
    const blockedId = String(userId || "")
    if (!blockedId) return NextResponse.json({ error: "userId is required" }, { status: 400 })
    if (blockedId === payload.userId) return NextResponse.json({ error: "You cannot block yourself" }, { status: 400 })
    const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } })
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

    await (prisma as any).userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: payload.userId, blockedId } },
      create: { blockerId: payload.userId, blockedId },
      update: {},
    })
    // Sever any existing connection in either direction — a block should not leave a link.
    await prisma.connection.deleteMany({
      where: {
        OR: [
          { userId: payload.userId, connectedId: blockedId },
          { userId: blockedId, connectedId: payload.userId },
        ],
      },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const blockedId = new URL(req.url).searchParams.get("userId") || ""
  if (!blockedId) return NextResponse.json({ error: "userId is required" }, { status: 400 })
  await (prisma as any).userBlock.deleteMany({ where: { blockerId: payload.userId, blockedId } })
  return NextResponse.json({ ok: true })
}
