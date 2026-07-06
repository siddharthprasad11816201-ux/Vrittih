import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"

// "Who viewed your profile" — recent distinct viewers + totals.
export async function GET(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  const payload = t ? verifyToken(t) : null
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const since = new Date(Date.now() - 90 * 86400_000)
  const [total, recentViews] = await Promise.all([
    prisma.profileView.count({ where: { profileId: payload.userId, createdAt: { gte: since } } }),
    prisma.profileView.findMany({ where: { profileId: payload.userId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ])
  // distinct most-recent viewer per person
  const seen = new Set<string>()
  const distinct = recentViews.filter((v) => (seen.has(v.viewerId) ? false : (seen.add(v.viewerId), true))).slice(0, 8)
  const viewers = await prisma.user.findMany({ where: { id: { in: distinct.map((d) => d.viewerId) } }, select: { id: true, name: true, avatar: true, headline: true } })
  const vMap = Object.fromEntries(viewers.map((u) => [u.id, u]))

  return NextResponse.json({
    total,
    viewers: distinct.map((d) => ({ ...(vMap[d.viewerId] || { id: d.viewerId, name: "Someone" }), viewedAt: d.createdAt })),
  })
}
