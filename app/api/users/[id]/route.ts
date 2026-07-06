import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"

// Public profile of another user. Records a profile view (for "who viewed you")
// when a signed-in user opens someone else's profile.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const t = req.cookies.get("er_token")?.value
  const payload = t ? verifyToken(t) : null
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, avatar: true, headline: true, bio: true, location: true, role: true, idVerified: true, openToWork: true, createdAt: true,
      profile: { select: { website: true, github: true, linkedin: true, twitter: true, birthDate: true } },
      experience: { orderBy: { startDate: "desc" } },
      education: { orderBy: { startYear: "desc" } },
      skills: { include: { skill: true } },
    },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  if (payload.userId !== params.id) {
    // record the view (dedupe within 6h to avoid spam)
    const recent = await prisma.profileView.findFirst({
      where: { viewerId: payload.userId, profileId: params.id, createdAt: { gte: new Date(Date.now() - 6 * 3600_000) } },
    })
    if (!recent) await prisma.profileView.create({ data: { viewerId: payload.userId, profileId: params.id } })
  }
  return NextResponse.json({ user, isSelf: payload.userId === params.id })
}
