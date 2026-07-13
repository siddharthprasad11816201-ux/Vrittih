import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ci } from "@/lib/db"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const email = searchParams.get("email") || ""
    const q = searchParams.get("q") || ""
    const where: any = {}
    if (email) where.email = email
    if (q) where.OR = [{ name:ci(q) },{ email:ci(q) }]
    if (!email && !q) return NextResponse.json({ users: [] })
    const user = email
      ? await prisma.user.findUnique({ where:{ email }, select:{ id:true,name:true,email:true,avatar:true,headline:true } })
      : null
    const users = !email ? await prisma.user.findMany({ where, select:{ id:true,name:true,email:true,avatar:true,headline:true }, take:10 }) : []
    return NextResponse.json({ user, users })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}