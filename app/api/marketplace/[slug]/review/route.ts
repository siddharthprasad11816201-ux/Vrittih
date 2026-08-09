import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { normalizeRating } from "@/lib/marketplace/catalog"

export const dynamic = "force-dynamic"

/* POST /api/marketplace/[slug]/review — leave/update a rating (1-5) + comment. Must
 * have the item installed (reviews come from actual users). ratingSum/ratingCount on
 * the item are kept exact by adjusting for any prior review from this user. */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const rating = normalizeRating(body.rating)
  if (rating < 1) return NextResponse.json({ error: "A rating of 1-5 is required." }, { status: 400 })
  const comment = body.comment ? String(body.comment).slice(0, 1000) : null

  const item = await prisma.marketplaceItem.findUnique({ where: { slug: params.slug }, select: { id: true } })
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

  const installed = await prisma.marketplaceInstall.findUnique({ where: { itemId_userId: { itemId: item.id, userId: ctx.userId } }, select: { id: true } })
  if (!installed) return NextResponse.json({ error: "Install this item before reviewing it." }, { status: 403 })

  const prior = await prisma.marketplaceReview.findUnique({ where: { itemId_userId: { itemId: item.id, userId: ctx.userId } }, select: { rating: true } })
  await prisma.marketplaceReview.upsert({
    where: { itemId_userId: { itemId: item.id, userId: ctx.userId } },
    update: { rating, comment },
    create: { itemId: item.id, userId: ctx.userId, rating, comment },
  })
  // keep the aggregate exact: replace the old contribution, or add a new one
  const sumDelta = prior ? rating - prior.rating : rating
  const countDelta = prior ? 0 : 1
  await prisma.marketplaceItem.update({ where: { id: item.id }, data: { ratingSum: { increment: sumDelta }, ratingCount: { increment: countDelta } } })
  return NextResponse.json({ success: true })
}
