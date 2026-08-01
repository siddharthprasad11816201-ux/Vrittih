import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { featureGate } from "@/lib/guard"
import { slugify } from "@/lib/company"
import { safeExternalUrl } from "@/lib/url"
import { validHex } from "@/lib/brand"
import { normalizeDomain, hostMatchesDomain } from "@/lib/partnerVerify"

export const dynamic = "force-dynamic"

/* White-label brand for the logged-in company (Scale). GET returns the current
 * brand (or a suggested slug from the account name); PUT creates/updates it. */

export async function GET(req: NextRequest) {
  const g = await featureGate(req, "api")
  if (g instanceof NextResponse) return g
  const brand = await prisma.partnerBrand.findUnique({ where: { employerId: g.user.id } })
  const me = await prisma.user.findUnique({ where: { id: g.user.id }, select: { name: true } })
  return NextResponse.json({ brand, suggestedSlug: slugify(me?.name || "company"), suggestedName: me?.name || "" })
}

export async function PUT(req: NextRequest) {
  const g = await featureGate(req, "api")
  if (g instanceof NextResponse) return g
  const body = await req.json().catch(() => ({}))

  const name = String(body.name || "").trim()
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })
  const slug = slugify(body.slug || name)
  if (slug.length < 2) return NextResponse.json({ error: "slug is too short" }, { status: 400 })

  // Slug must be globally unique across brands.
  const clash = await prisma.partnerBrand.findFirst({ where: { slug, employerId: { not: g.user.id } }, select: { id: true } })
  if (clash) return NextResponse.json({ error: `The link /c/${slug} is taken — choose another slug.` }, { status: 409 })

  const color = validHex(body.color) || "#0F6E56"

  // Optional custom domain — must be a domain the company has verified (exact or
  // subdomain of one), and not already claimed by another brand.
  let customDomain: string | null | undefined = undefined
  if (body.customDomain !== undefined) {
    if (!body.customDomain) customDomain = null
    else {
      const dom = normalizeDomain(body.customDomain)
      if (!dom) return NextResponse.json({ error: "Invalid custom domain." }, { status: 400 })
      const verified = await prisma.partnerDomain.findMany({ where: { employerId: g.user.id, verified: true }, select: { domain: true } })
      if (!verified.some((v) => hostMatchesDomain(dom, v.domain))) {
        return NextResponse.json({ error: `Verify ${dom} (or its parent domain) under Domains before using it as your custom domain.` }, { status: 400 })
      }
      const taken = await prisma.partnerBrand.findFirst({ where: { customDomain: dom, employerId: { not: g.user.id } }, select: { id: true } })
      if (taken) return NextResponse.json({ error: `${dom} is already in use.` }, { status: 409 })
      customDomain = dom
    }
  }

  const data: any = {
    name: name.slice(0, 120),
    slug,
    tagline: body.tagline ? String(body.tagline).slice(0, 200) : null,
    about: body.about ? String(body.about).slice(0, 2000) : null,
    logoUrl: safeExternalUrl(body.logoUrl),
    color,
    active: body.active !== false,
  }
  if (customDomain !== undefined) data.customDomain = customDomain
  const brand = await prisma.partnerBrand.upsert({
    where: { employerId: g.user.id },
    update: data,
    create: { employerId: g.user.id, ...data },
  })
  return NextResponse.json({ ok: true, brand, url: `/c/${brand.slug}` })
}
