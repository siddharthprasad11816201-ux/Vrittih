import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const test = await (prisma as any).test.findUnique({
      where: { id: params.id },
      include: {
        questions: { orderBy: { order: "asc" }, select: { id:true,type:true,text:true,options:true,points:true,order:true } },
        _count: { select: { questions:true, attempts:true } }
      }
    })
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 })
    return NextResponse.json({ test })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}