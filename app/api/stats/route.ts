import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Public homepage stats — real, live platform numbers. Cached in-process for a
// minute so the landing page can hammer it without touching the DB each hit.
let cache: { at: number; data: any } | null = null
const TTL = 60_000

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) return NextResponse.json(cache.data)

  const [jobs, companies, industriesRows, productBrands] = await Promise.all([
    prisma.job.count({ where: { active: true } }),
    prisma.company.count(),
    prisma.job.findMany({ where: { active: true }, select: { industry: true }, distinct: ["industry"] }),
    // the real, recognisable brands hiring here (the EduRankAI product family)
    prisma.company.findMany({
      where: { owner: { source: "edurankai" } },
      orderBy: { createdAt: "asc" },
      select: { name: true, slug: true },
    }),
  ])

  // fill up to 6 with other verified companies if the product family is short
  let brands = productBrands
  if (brands.length < 6) {
    const more = await prisma.company.findMany({
      where: { verified: true, slug: { notIn: brands.map((b) => b.slug) } },
      orderBy: { followers: { _count: "desc" } }, take: 6 - brands.length,
      select: { name: true, slug: true },
    })
    brands = [...brands, ...more]
  }

  const data = { jobs, companies, industries: industriesRows.length, brands }
  cache = { at: Date.now(), data }
  return NextResponse.json(data)
}
