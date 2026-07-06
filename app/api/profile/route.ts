import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        profile: true,
        experience: { orderBy: { startDate: "desc" } },
        education: { orderBy: { startYear: "desc" } },
        skills: { include: { skill: true } },
      },
    })
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const { password, twoFactorSecret, faceVector, ...safe } = user as any
    return NextResponse.json({ user: safe })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const body = await req.json()
    const { name, headline, bio, location, phone, avatar, website, github, linkedin, twitter } = body
    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        name: name || undefined,
        headline: headline ?? undefined,
        bio: bio ?? undefined,
        location: location ?? undefined,
        phone: phone ?? undefined,
        avatar: avatar ?? undefined,
        profile: {
          upsert: {
            create: { website, github, linkedin, twitter },
            update: { website, github, linkedin, twitter },
          },
        },
      },
      include: { profile: true },
    })
    const { password, twoFactorSecret, faceVector, ...safe } = user as any
    return NextResponse.json({ user: safe })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}