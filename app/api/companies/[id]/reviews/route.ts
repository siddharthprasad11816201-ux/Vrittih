import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

// Published reviews + the aggregate rating. Aggregates are computed from PUBLISHED rows
// only, so a pending or rejected review never moves the public score.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = auth(req)
  const reviews = await (prisma as any).companyReview.findMany({
    where: { companyId: params.id, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const authorIds = [...new Set(reviews.map((r: any) => r.authorId))] as string[]
  const authors = authorIds.length
    ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, avatar: true, headline: true } })
    : []
  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]))

  const distribution = [1, 2, 3, 4, 5].map((star) => ({ star, count: reviews.filter((r: any) => r.rating === star).length }))
  const average = reviews.length ? +(reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(2) : null

  // Whether the caller already reviewed (any status), so the UI can offer edit vs create.
  let mine = null
  if (payload) {
    mine = await (prisma as any).companyReview.findUnique({
      where: { companyId_authorId: { companyId: params.id, authorId: payload.userId } },
    })
  }

  return NextResponse.json({
    average, count: reviews.length, distribution,
    myReview: mine ? { id: mine.id, rating: mine.rating, title: mine.title, pros: mine.pros, cons: mine.cons, status: mine.status } : null,
    reviews: reviews.map((r: any) => ({
      id: r.id, rating: r.rating, title: r.title, pros: r.pros, cons: r.cons, createdAt: r.createdAt,
      author: authorMap[r.authorId] || { id: r.authorId, name: "Unknown" },
    })),
  })
}

// Create or replace your review of this company. Goes to PENDING for moderation.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const body = await req.json()
    const rating = Math.round(Number(body?.rating))
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 })
    }
    const company = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 })

    const str = (v: any, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)
    const data = {
      rating,
      title: str(body?.title, 120),
      pros: str(body?.pros, 2000),
      cons: str(body?.cons, 2000),
      status: "PENDING",
    }

    const saved = await (prisma as any).companyReview.upsert({
      where: { companyId_authorId: { companyId: params.id, authorId: payload.userId } },
      create: { companyId: params.id, authorId: payload.userId, ...data },
      update: data,
    })
    return NextResponse.json({ ok: true, id: saved.id, status: saved.status }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  await (prisma as any).companyReview.deleteMany({ where: { companyId: params.id, authorId: payload.userId } })
  return NextResponse.json({ ok: true })
}
