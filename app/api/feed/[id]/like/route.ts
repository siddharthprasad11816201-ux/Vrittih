import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"

// Toggle a like on a post.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const t = req.cookies.get("er_token")?.value
  const payload = t ? verifyToken(t) : null
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const existing = await prisma.postLike.findUnique({ where: { postId_userId: { postId: params.id, userId: payload.userId } } })
  if (existing) {
    await prisma.postLike.delete({ where: { postId_userId: { postId: params.id, userId: payload.userId } } })
  } else {
    await prisma.postLike.create({ data: { postId: params.id, userId: payload.userId } })
  }
  const likes = await prisma.postLike.count({ where: { postId: params.id } })
  return NextResponse.json({ success: true, liked: !existing, likes })
}
