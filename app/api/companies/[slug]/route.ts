import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { slugify, sizeBand, generatedAbout } from "@/lib/company"

export const dynamic = "force-dynamic"

function currentUserId(req: NextRequest): string | null {
  const token = req.cookies.get("er_token")?.value
  if (!token) return null
  return verifyToken(token)?.userId ?? null
}

// Find the company by slug. If there's no row yet but jobs exist under a name that
// slugifies to this slug, create the page on the fly (backfill-on-demand) so any
// company with listings has a real hub.
async function resolveCompany(slug: string) {
  let company = await prisma.company.findUnique({ where: { slug } })
  if (company) return company
  const names = await prisma.job.groupBy({ by: ["company"], where: { active: true }, _count: { _all: true } })
  const match = names.find((n) => slugify(n.company) === slug)
  if (!match) return null
  const sample = await prisma.job.findFirst({ where: { company: match.company }, select: { industry: true, location: true } })
  const industry = sample?.industry || "Technology"
  const hq = sample?.location || ""
  return prisma.company.create({
    data: {
      slug, name: match.company, industry, headquarters: hq,
      size: sizeBand(match._count._all), about: generatedAbout(match.company, industry, hq),
      tagline: `${industry} · Hiring now`,
    },
  })
}

// GET /api/companies/:slug -> full profile + open roles + follow state.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const company = await resolveCompany(params.slug)
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 })

  const [roles, totalRoles, followers, uid] = await Promise.all([
    prisma.job.findMany({
      where: { company: company.name, active: true },
      orderBy: { createdAt: "desc" }, take: 60,
      select: { id: true, title: true, location: true, type: true, salary: true, remote: true, createdAt: true },
    }),
    prisma.job.count({ where: { company: company.name, active: true } }),
    prisma.companyFollow.count({ where: { companyId: company.id } }),
    currentUserId(req),
  ])

  const locations = Array.from(new Set(roles.map((r) => r.location))).slice(0, 8)
  let following = false
  if (uid) following = !!(await prisma.companyFollow.findUnique({ where: { userId_companyId: { userId: uid, companyId: company.id } } }))
  const canEdit = !!uid && (uid === company.ownerId || (await isAdmin(uid)))

  return NextResponse.json({
    company: {
      slug: company.slug, name: company.name, tagline: company.tagline, about: company.about,
      website: company.website, industry: company.industry, size: company.size,
      headquarters: company.headquarters, founded: company.founded, logoUrl: company.logoUrl, verified: company.verified,
    },
    stats: { openRoles: totalRoles, followers, locations },
    roles, following, canEdit,
  })
}

async function isAdmin(uid: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } })
  return u?.role === "ADMIN" || u?.role === "SUPER_ADMIN"
}

// PATCH /api/companies/:slug -> owner (or admin) edits the page.
export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  const uid = currentUserId(req)
  if (!uid) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const company = await prisma.company.findUnique({ where: { slug: params.slug } })
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 })
  if (uid !== company.ownerId && !(await isAdmin(uid))) return NextResponse.json({ error: "You don't manage this company." }, { status: 403 })

  const b = await req.json()
  const str = (v: any, max = 2000) => (v == null ? undefined : String(v).slice(0, max))
  const updated = await prisma.company.update({
    where: { id: company.id },
    data: {
      tagline: str(b.tagline, 140), about: str(b.about, 4000), website: str(b.website, 300),
      industry: str(b.industry, 60), size: str(b.size, 20), headquarters: str(b.headquarters, 120),
      founded: b.founded != null ? Math.max(1800, Math.min(2100, parseInt(b.founded, 10) || 0)) || null : undefined,
      logoUrl: str(b.logoUrl, 300),
    },
    select: { slug: true },
  })
  return NextResponse.json({ ok: true, slug: updated.slug })
}
