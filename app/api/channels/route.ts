import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const channels = await prisma.channel.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { members:true, posts:true } },
        members: { where: { userId: payload.userId }, select: { id:true } },
      },
    })
    return NextResponse.json({ channels })
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
    const { name, description, type } = await req.json()
    if (!name) return NextResponse.json({ error: "Channel name required" }, { status: 400 })
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-")
    const channel = await prisma.channel.create({
      data: {
        name: slug, description, type: type||"PUBLIC",
        createdById: payload.userId,
        members: { create: { userId: payload.userId, role: "ADMIN" } },
      },
    })
    return NextResponse.json({ success:true, channel }, { status: 201 })
  } catch (err: any) {
    if (err.code === "P2002") return NextResponse.json({ error: "Channel name already exists" }, { status: 409 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}