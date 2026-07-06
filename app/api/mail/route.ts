import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const folder = searchParams.get("folder") || "inbox"
    const q = searchParams.get("q") || ""
    let where: any = {}
    if (folder === "inbox") where = { toId: payload.userId, deletedAt: null, archived: false }
    if (folder === "sent") where = { fromId: payload.userId, deletedAt: null }
    if (folder === "starred") where = { toId: payload.userId, starred: true, deletedAt: null }
    if (folder === "archived") where = { toId: payload.userId, archived: true, deletedAt: null }
    if (q) where.OR = [{ subject:{ contains:q } },{ body:{ contains:q } }]
    const mails = await prisma.mail.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        from: { select:{ id:true,name:true,email:true,avatar:true } },
        to: { select:{ id:true,name:true,email:true,avatar:true } },
      },
    })
    const unread = await prisma.mail.count({ where:{ toId:payload.userId, read:false, deletedAt:null } })
    return NextResponse.json({ mails, unread })
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
    const { id, action } = await req.json()
    const update: any = {}
    if (action === "read") update.read = true
    if (action === "unread") update.read = false
    if (action === "star") update.starred = true
    if (action === "unstar") update.starred = false
    if (action === "archive") update.archived = true
    if (action === "delete") update.deletedAt = new Date()
    await prisma.mail.updateMany({ where:{ id, toId:payload.userId }, data:update })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}