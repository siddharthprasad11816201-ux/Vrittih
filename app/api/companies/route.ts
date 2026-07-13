import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET /api/companies?q=&page=&sort=  -> paginated company directory with live
// open-role counts and follower counts.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const q = (sp.get("q") || "").trim().slice(0, 60)
  const sort = sp.get("sort") || "followers"
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1)
  const pageSize = 24

  const where = q
    ? { OR: [{ name: { contains: q } }, { industry: { contains: q } }, { tagline: { contains: q } }] }
    : {}

  const orderBy =
    sort === "name" ? [{ name: "asc" as const }]
    : sort === "new" ? [{ createdAt: "desc" as const }]
    : [{ verified: "desc" as const }, { followers: { _count: "desc" as const } }, { name: "asc" as const }]

  const [total, companies, roleCounts] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where, orderBy, skip: (page - 1) * pageSize, take: pageSize,
      select: { slug: true, name: true, tagline: true, industry: true, headquarters: true, size: true, logoUrl: true, verified: true, _count: { select: { followers: true } } },
    }),
    prisma.job.groupBy({ by: ["company"], where: { active: true }, _count: { _all: true } }),
  ])

  const roles: Record<string, number> = {}
  for (const r of roleCounts) roles[r.company] = r._count._all

  return NextResponse.json({
    page, pageSize, total, pages: Math.ceil(total / pageSize),
    companies: companies.map((c) => ({
      slug: c.slug, name: c.name, tagline: c.tagline, industry: c.industry,
      headquarters: c.headquarters, size: c.size, logoUrl: c.logoUrl, verified: c.verified,
      followers: c._count.followers, openRoles: roles[c.name] || 0,
    })),
  })
}
