import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

// GET: comments on a post, with author info.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!auth(req)) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const comments = await prisma.postComment.findMany({ where: { postId: params.id }, orderBy: { createdAt: "asc" }, take: 200 })
  const userIds = [...new Set(comments.map((c) => c.userId))]
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, avatar: true, headline: true } })
  const uMap = Object.fromEntries(users.map((u) => [u.id, u]))
  return NextResponse.json({ comments: comments.map((c) => ({ id: c.id, content: c.content, createdAt: c.createdAt, author: uMap[c.userId] || { id: c.userId, name: "Unknown" } })) })
}

// POST: add a comment.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { content } = await req.json()
  const text = String(content || "").trim()
  if (!text) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 })
  const comment = await prisma.postComment.create({ data: { postId: params.id, userId: payload.userId, content: text.slice(0, 2000) } })
  return NextResponse.json({ success: true, comment }, { status: 201 })
}
