import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const pages = await (prisma as any).professionalPage.findMany({
      orderBy: { followers: "desc" },
      take: 50,
      include: {
        user: { select: { id:true,name:true,avatar:true,headline:true,location:true } },
        pageFollows: { where: { userId: payload.userId } },
        _count: { select: { pageFollows:true, pagePosts:true } }
      }
    })
    return NextResponse.json({ pages })
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
    const { title, bio, badge } = await req.json()
    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 })
    const existing = await (prisma as any).professionalPage.findUnique({ where: { userId: payload.userId } })
    if (existing) return NextResponse.json({ error: "You already have a professional page" }, { status: 409 })
    const page = await (prisma as any).professionalPage.create({
      data: { userId: payload.userId, title, bio, badge }
    })
    return NextResponse.json({ success: true, page }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}