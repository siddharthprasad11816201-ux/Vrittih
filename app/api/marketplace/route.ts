import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { ensureSeeded } from "@/lib/marketplace/seed"
import { ratingAvg, validatePublish, slugify } from "@/lib/marketplace/catalog"

export const dynamic = "force-dynamic"

const SORTS = new Set(["installs", "rating", "new"])

/* GET /api/marketplace — browse published items (search / kind / category / sort),
 * plus ?mine=1 (items I published) and ?installed=1 (items I installed). Returns
 * real installs + honest rating average, and the caller's install state per item. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  await ensureSeeded().catch(() => {})

  const sp = req.nextUrl.searchParams
  const q = (sp.get("q") || "").trim().slice(0, 80)
  const kind = (sp.get("kind") || "").toUpperCase()
  const category = (sp.get("category") || "").trim()
  const sort = SORTS.has(sp.get("sort") || "") ? sp.get("sort")! : "installs"
  const mine = sp.get("mine") === "1"
  const installed = sp.get("installed") === "1"

  const where: any = { status: "PUBLISHED" }
  if (mine) where.status = undefined, where.authorId = ctx.userId   // my own drafts + published
  if (kind) where.kind = kind
  if (category) where.category = category
  if (q) where.OR = [{ name: { contains: q } }, { summary: { contains: q } }]

  let ids: Set<string> | null = null
  if (installed) {
    const myInstalls = await prisma.marketplaceInstall.findMany({ where: { userId: ctx.userId }, select: { itemId: true } })
    ids = new Set(myInstalls.map(i => i.itemId))
    where.id = { in: [...ids] }
    where.status = "PUBLISHED"
  }

  const orderBy = sort === "rating" ? [{ ratingSum: "desc" as const }] : sort === "new" ? [{ createdAt: "desc" as const }] : [{ installs: "desc" as const }]
  const items = await prisma.marketplaceItem.findMany({ where, orderBy, take: 200 })

  // resolve the caller's installs (for the browse tab) + author display names in one pass
  if (!ids) {
    const myInstalls = await prisma.marketplaceInstall.findMany({ where: { userId: ctx.userId, itemId: { in: items.map(i => i.id) } }, select: { itemId: true } })
    ids = new Set(myInstalls.map(i => i.itemId))
  }
  const authorIds = [...new Set(items.map(i => i.authorId).filter(a => a !== "edurankai"))]
  const authors = authorIds.length ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } }) : []
  const nameById = new Map(authors.map(a => [a.id, a.name]))

  return NextResponse.json({
    items: items.map(i => shape(i, ids!.has(i.id), i.authorId === ctx.userId, nameById)),
    categories: [...new Set(items.map(i => i.category).filter(Boolean))],
  })
}

/* POST /api/marketplace — publish a user asset (PROMPT/WORKFLOW). AGENT/TOOL are
 * platform-governed (admin only) since they represent runnable capabilities. */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const v = validatePublish(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  // unique slug from the name
  const base = slugify(v.name) || "item"
  let slug = base
  for (let n = 2; await prisma.marketplaceItem.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${base}-${n}`

  const item = await prisma.marketplaceItem.create({
    data: { authorId: ctx.userId, kind: v.kind, name: v.name, slug, summary: v.summary, category: v.category, spec: v.spec, status: "PUBLISHED", price: 0, currency: "CHF" },
  })
  return NextResponse.json({ success: true, slug: item.slug }, { status: 201 })
}

function shape(i: any, installed: boolean, mine: boolean, nameById: Map<string, string | null>) {
  let capId: string | null = null
  try { capId = JSON.parse(i.spec || "{}").capId || null } catch {}
  return {
    id: i.id, slug: i.slug, name: i.name, kind: i.kind, category: i.category, summary: i.summary,
    price: i.price, currency: i.currency, version: i.version, status: i.status,
    author: i.authorId === "edurankai" ? "Vrittih" : (nameById.get(i.authorId) || "A member"),
    installs: i.installs, rating: { avg: ratingAvg(i.ratingSum, i.ratingCount), count: i.ratingCount },
    installed, mine, runnable: i.kind === "AGENT" && !!capId,
  }
}
