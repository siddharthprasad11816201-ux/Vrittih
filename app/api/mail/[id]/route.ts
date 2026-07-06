import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const mail = await (prisma as any).mail.findFirst({
      where: { id: params.id, OR: [{ toId: payload.userId }, { fromId: payload.userId }] },
      include: {
        from: { select: { id:true,name:true,email:true,avatar:true } },
        to: { select: { id:true,name:true,email:true,avatar:true } },
      },
    })
    if (!mail) return NextResponse.json({ error: "Mail not found" }, { status: 404 })
    if (mail.toId === payload.userId && !mail.read) {
      await (prisma as any).mail.update({ where: { id: params.id }, data: { read: true } })
    }
    return NextResponse.json({ mail })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}