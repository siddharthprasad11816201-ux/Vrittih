import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ci } from "@/lib/db"
import { requireAuthority, viewerCapabilities, diffRecords, auditAdmin, pickFields } from "@/lib/admin/authority"

export const dynamic = "force-dynamic"

// Fields an admin may correct on a company profile.
const EDITABLE = ["name", "slug", "tagline", "about", "website", "industry", "size", "headquarters", "logoUrl"] as const

export async function GET(req: NextRequest) {
  const gate = await requireAuthority(req)
  if (!gate.ok) return gate.response
  const auth = gate.authority

  const url = new URL(req.url)
  const q = url.searchParams.get("q") || ""
  const includeArchived = url.searchParams.get("includeArchived") === "true"
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
  const limit = 20

  const where: any = {}
  if (!includeArchived) where.archived = false
  if (q) where.OR = [{ name: ci(q) }, { slug: ci(q) }]

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { name: "asc" },
      include: { _count: { select: { followers: true } } },
    }),
    prisma.company.count({ where }),
  ])
  return NextResponse.json({ companies, total, pages: Math.ceil(total / limit), viewer: await viewerCapabilities(req) })
}

// Edit, verify/unverify, archive/restore.
export async function PATCH(req: NextRequest) {
  const gate = await requireAuthority(req)
  if (!gate.ok) return gate.response
  const auth = gate.authority
  try {
    const body = await req.json()
    const companyId = String(body?.companyId || "")
    if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 })

    const before = await prisma.company.findUnique({ where: { id: companyId } })
    if (!before) return NextResponse.json({ error: "Company not found" }, { status: 404 })

    const data: any = pickFields(body, EDITABLE)
    if (data.name === null) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 })
    if (data.slug !== undefined) {
      if (!data.slug) return NextResponse.json({ error: "Slug cannot be empty." }, { status: 400 })
      // The slug is the public URL for the company, so a collision would silently point
      // two companies at one page.
      const clash = await prisma.company.findFirst({ where: { slug: data.slug, id: { not: companyId } }, select: { id: true } })
      if (clash) return NextResponse.json({ error: `Another company already uses the slug "${data.slug}".` }, { status: 409 })
    }
    if (body.verified !== undefined) data.verified = !!body.verified
    if (body.archived !== undefined) data.archived = !!body.archived
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    const after = await prisma.company.update({ where: { id: companyId }, data })
    const action = body.archived === true ? "company.archive" : body.archived === false ? "company.restore" : "company.edit"
    await auditAdmin(auth, action, { companyId, changes: diffRecords(before, after, [...EDITABLE, "verified", "archived"]) }, req)
    return NextResponse.json({ success: true, company: after })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Permanent deletion. Super admin only. Note it removes the company PAGE and its
// followers; job postings reference the company by name and are left published, which the
// response states explicitly. Archiving is the reversible option the UI offers first.
export async function DELETE(req: NextRequest) {
  const gate = await requireAuthority(req, { destructive: true })
  if (!gate.ok) return gate.response
  const auth = gate.authority
  try {
    const { companyId } = await req.json()
    if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 })

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, slug: true, _count: { select: { followers: true } } },
    })
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 })

    // Jobs are linked to a company by NAME, not by a foreign key, so deleting the company
    // page ORPHANS its postings rather than removing them. Report that plainly instead of
    // letting an admin assume the listings went too.
    const orphanedJobs = await prisma.job.count({ where: { company: company.name } })

    // Snapshot before the row disappears so the trail outlives it.
    await auditAdmin(auth, "company.delete",
      { companyId, name: company.name, slug: company.slug, followers: company._count.followers, orphanedJobs }, req)

    await prisma.company.delete({ where: { id: companyId } })
    return NextResponse.json({
      success: true, orphanedJobs,
      note: orphanedJobs > 0
        ? `${orphanedJobs} job posting(s) referenced this company by name and remain published. Archive them separately if they should be withdrawn.`
        : undefined,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
