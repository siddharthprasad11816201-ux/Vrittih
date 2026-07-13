import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { tokenize, rank, scoreFields } from "@/lib/search"

export const dynamic = "force-dynamic"

// Unified platform search: jobs + people + companies, ranked in-house.
// SQL pre-filters candidates cheaply (OR-contains on indexed text), then lib/search
// ranks them so results are ordered by real relevance, not insertion order.
export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").slice(0, 80)
  const tokens = tokenize(raw).slice(0, 8)
  if (!tokens.length) return NextResponse.json({ q: raw, jobs: [], people: [], companies: [] })

  const contains = (fields: string[]) => ({
    OR: tokens.flatMap((t) => fields.map((f) => ({ [f]: { contains: t } }))),
  })

  const [jobCand, peopleCand, companyRows] = await Promise.all([
    prisma.job.findMany({
      where: { active: true, ...contains(["title", "company", "industry", "location", "description"]) },
      select: { id: true, title: true, company: true, industry: true, location: true, description: true, type: true, salary: true, remote: true },
      take: 400,
    }),
    prisma.user.findMany({
      where: { banned: false, ...contains(["name", "headline", "bio", "location"]) },
      select: { id: true, name: true, headline: true, avatar: true, location: true, role: true },
      take: 250,
    }),
    prisma.job.groupBy({
      by: ["company"],
      where: { active: true, ...contains(["company"]) },
      _count: { _all: true },
      orderBy: { _count: { company: "desc" } },
      take: 40,
    }),
  ])

  const jobs = rank(jobCand, tokens, (j) => [
    { text: j.title, weight: 6 },
    { text: j.company, weight: 3 },
    { text: j.industry, weight: 2 },
    { text: j.location, weight: 2 },
    { text: j.description, weight: 1 },
  ], 8).map((j) => ({
    id: j.id, title: j.title, company: j.company, location: j.location,
    type: j.type, salary: j.salary, remote: j.remote,
  }))

  const people = rank(peopleCand, tokens, (u) => [
    { text: u.name, weight: 6 },
    { text: u.headline || "", weight: 3 },
    { text: u.location || "", weight: 2 },
  ], 6).map((u) => ({
    id: u.id, name: u.name, headline: u.headline, avatar: u.avatar, location: u.location,
    isEmployer: u.role === "EMPLOYER",
  }))

  const companies = companyRows
    .map((c) => ({ company: c.company, count: c._count._all, _score: scoreFields(tokens, [{ text: c.company, weight: 6 }]) }))
    .filter((c) => c._score > 0)
    .sort((a, b) => b._score - a._score || b.count - a.count)
    .slice(0, 6)
    .map(({ company, count }) => ({ company, count }))

  return NextResponse.json({ q: raw, jobs, people, companies })
}
