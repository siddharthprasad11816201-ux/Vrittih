import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { getCapability } from "@/lib/aios"
import { ratingAvg } from "@/lib/marketplace/catalog"

export const dynamic = "force-dynamic"

/* GET /api/marketplace/[slug] — item detail + reviews + the caller's install state.
 * For AGENT items we resolve the mapped capability so the UI knows if "Run" is live
 * and what single input (runField) it needs. */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const item = await prisma.marketplaceItem.findUnique({
    where: { slug: params.slug },
    include: { reviews: { orderBy: { createdAt: "desc" }, take: 50 } },
  })
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

  let spec: any = {}
  try { spec = JSON.parse(item.spec || "{}") } catch {}
  const cap = item.kind === "AGENT" && spec.capId ? await getCapability(spec.capId).catch(() => null) : null

  const installed = !!(await prisma.marketplaceInstall.findUnique({ where: { itemId_userId: { itemId: item.id, userId: ctx.userId } }, select: { id: true } }).catch(() => null))
  const reviewerIds = [...new Set(item.reviews.map(r => r.userId))]
  const reviewers = reviewerIds.length ? await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } }) : []
  const nameById = new Map(reviewers.map(u => [u.id, u.name]))
  const mine = !!(await prisma.marketplaceReview.findUnique({ where: { itemId_userId: { itemId: item.id, userId: ctx.userId } }, select: { id: true } }).catch(() => null))

  return NextResponse.json({
    item: {
      id: item.id, slug: item.slug, name: item.name, kind: item.kind, category: item.category, summary: item.summary,
      price: item.price, currency: item.currency, version: item.version, status: item.status,
      author: item.authorId === "edurankai" ? "Vrittih" : (nameById.get(item.authorId) || "A member"),
      isAuthor: item.authorId === ctx.userId, installs: item.installs,
      rating: { avg: ratingAvg(item.ratingSum, item.ratingCount), count: item.ratingCount },
      installed, hasReviewed: mine, spec,
      // "Run" is only offered when the mapped capability actually exists + is enabled.
      runnable: item.kind === "AGENT" && !!cap && cap.enabled !== false,
      runField: spec.runField || null,
    },
    reviews: item.reviews.map(r => ({ id: r.id, rating: r.rating, comment: r.comment, by: nameById.get(r.userId) || "A member", createdAt: r.createdAt })),
  })
}

/* DELETE /api/marketplace/[slug] — author (or platform admin) removes their item. */
export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const item = await prisma.marketplaceItem.findUnique({ where: { slug: params.slug }, select: { id: true, authorId: true } })
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })
  if (item.authorId !== ctx.userId && !ctx.has("admin.access")) return NextResponse.json({ error: "Not your item." }, { status: 403 })
  await prisma.marketplaceItem.delete({ where: { id: item.id } })
  return NextResponse.json({ success: true })
}
