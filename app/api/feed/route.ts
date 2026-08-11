import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { track } from "@/lib/analytics"
import { parseHashtags, tallyReactions, hiddenUserIds } from "@/lib/social/engage"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

// GET: recent posts with author info, reaction tallies, reposted source, hashtags, and
// whether the viewer reacted. Blocked users' posts are filtered out (mutual).
// ?tag=<hashtag> restricts the feed to a topic.
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const tag = (new URL(req.url).searchParams.get("tag") || "").toLowerCase().replace(/^#/, "")

  // Mutual block filter: hide anyone the viewer blocked AND anyone who blocked the viewer.
  const blocks = await (prisma as any).userBlock.findMany({
    where: { OR: [{ blockerId: payload.userId }, { blockedId: payload.userId }] },
  })
  const hidden = hiddenUserIds(blocks, payload.userId)

  const where: any = {}
  if (hidden.size) where.authorId = { notIn: [...hidden] }
  if (tag) where.hashtags = { some: { hashtag: { tag } } }

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      _count: { select: { comments: true, reposts: true } },
      likes: { select: { userId: true, reaction: true } },
      hashtags: { include: { hashtag: true } },
      repostOf: { select: { id: true, content: true, authorId: true, createdAt: true } },
    },
  })

  // Authors of both the posts and any reposted originals.
  const authorIds = [...new Set([
    ...posts.map((p) => p.authorId),
    ...posts.map((p: any) => p.repostOf?.authorId).filter(Boolean),
  ])] as string[]
  const authors = await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, avatar: true, headline: true } })
  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]))

  return NextResponse.json({
    tag: tag || null,
    posts: posts.map((p: any) => {
      const tally = tallyReactions(p.likes)
      const mine = p.likes.find((l: any) => l.userId === payload.userId)
      return {
        id: p.id, content: p.content, createdAt: p.createdAt,
        author: authorMap[p.authorId] || { id: p.authorId, name: "Unknown" },
        likes: tally.total, reactions: tally.byType,
        likedByMe: !!mine, myReaction: mine?.reaction ?? null,
        comments: p._count.comments, reposts: p._count.reposts,
        hashtags: p.hashtags.map((h: any) => h.hashtag.tag),
        repostOf: p.repostOf
          ? { id: p.repostOf.id, content: p.repostOf.content, createdAt: p.repostOf.createdAt, author: authorMap[p.repostOf.authorId] || { id: p.repostOf.authorId, name: "Unknown" } }
          : null,
      }
    }),
  })
}

// POST: publish a post, or repost another with an optional quote ({ repostOf }).
// Hashtags in the text are parsed and indexed for topic pages.
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const body = await req.json()
  const text = String(body?.content || "").trim()
  const repostOfId = body?.repostOf ? String(body.repostOf) : null

  // A repost may be quote-free; a normal post may not be empty.
  if (!text && !repostOfId) return NextResponse.json({ error: "Post cannot be empty" }, { status: 400 })
  if (text.length > 5000) return NextResponse.json({ error: "Post too long" }, { status: 400 })

  if (repostOfId) {
    const src = await prisma.post.findUnique({ where: { id: repostOfId }, select: { id: true, repostOfId: true } })
    if (!src) return NextResponse.json({ error: "Original post not found" }, { status: 404 })
    // Reposting a repost points at the ORIGINAL, so chains never nest.
    if (src.repostOfId) body.repostOf = src.repostOfId
  }

  const tags = parseHashtags(text)
  const post = await prisma.post.create({
    data: {
      authorId: payload.userId,
      content: text,
      repostOfId: repostOfId ? String(body.repostOf) : null,
      hashtags: tags.length
        ? {
            create: await Promise.all(tags.map(async (tag) => {
              const h = await prisma.hashtag.upsert({ where: { tag }, create: { tag }, update: {} })
              return { hashtagId: h.id }
            })),
          }
        : undefined,
    },
  })
  await track(repostOfId ? "post.reposted" : "post.created", { tags: tags.length }, payload.userId)
  return NextResponse.json({ success: true, post, hashtags: tags }, { status: 201 })
}
