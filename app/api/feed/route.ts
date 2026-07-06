import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { track } from "@/lib/analytics"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

// GET: recent posts with author info, counts, and whether the viewer liked each.
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { likes: true, comments: true } } },
  })
  const authorIds = [...new Set(posts.map((p) => p.authorId))]
  const authors = await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, avatar: true, headline: true } })
  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]))
  const liked = new Set((await prisma.postLike.findMany({ where: { userId: payload.userId, postId: { in: posts.map((p) => p.id) } }, select: { postId: true } })).map((l) => l.postId))

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id, content: p.content, createdAt: p.createdAt,
      author: authorMap[p.authorId] || { id: p.authorId, name: "Unknown" },
      likes: p._count.likes, comments: p._count.comments, likedByMe: liked.has(p.id),
    })),
  })
}

// POST: publish a post.
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { content } = await req.json()
  const text = String(content || "").trim()
  if (!text) return NextResponse.json({ error: "Post cannot be empty" }, { status: 400 })
  if (text.length > 5000) return NextResponse.json({ error: "Post too long" }, { status: 400 })
  const post = await prisma.post.create({ data: { authorId: payload.userId, content: text } })
  await track("post.created", {}, payload.userId)
  return NextResponse.json({ success: true, post }, { status: 201 })
}
