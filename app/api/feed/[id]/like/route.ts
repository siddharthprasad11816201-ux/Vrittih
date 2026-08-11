import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { normalizeReaction, tallyReactions } from "@/lib/social/engage"

export const dynamic = "force-dynamic"

// Toggle / change a reaction on a post.
// Body may carry { reaction }: "like" (default) | celebrate | support | insightful | curious.
// Same reaction again removes it; a DIFFERENT reaction switches it (one per user per post).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const t = req.cookies.get("er_token")?.value
  const payload = t ? verifyToken(t) : null
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let reaction = "like"
  try { reaction = normalizeReaction((await req.json())?.reaction) } catch { reaction = "like" }

  const key = { postId_userId: { postId: params.id, userId: payload.userId } }
  const existing = await prisma.postLike.findUnique({ where: key })
  let reacted: boolean
  if (existing && existing.reaction === reaction) {
    await prisma.postLike.delete({ where: key })
    reacted = false
  } else if (existing) {
    await prisma.postLike.update({ where: key, data: { reaction } })
    reacted = true
  } else {
    await prisma.postLike.create({ data: { postId: params.id, userId: payload.userId, reaction } })
    reacted = true
  }

  const rows = await prisma.postLike.findMany({ where: { postId: params.id }, select: { reaction: true } })
  const tally = tallyReactions(rows)
  // `liked`/`likes` are kept for the existing UI; reactions are additive.
  return NextResponse.json({
    success: true, liked: reacted, likes: tally.total,
    myReaction: reacted ? reaction : null, reactions: tally.byType,
  })
}
