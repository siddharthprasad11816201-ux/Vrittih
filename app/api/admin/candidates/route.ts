import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ci } from "@/lib/db"
import { requireAuthority, viewerCapabilities, diffRecords, auditAdmin, pickFields } from "@/lib/admin/authority"

export const dynamic = "force-dynamic"

const EDITABLE = ["displayName", "location", "currentEmployer", "headline"] as const

export async function GET(req: NextRequest) {
  const gate = await requireAuthority(req)
  if (!gate.ok) return gate.response
  const auth = gate.authority

  const url = new URL(req.url)
  const q = url.searchParams.get("q") || ""
  const includeArchived = url.searchParams.get("includeArchived") === "true"
  const includeMerged = url.searchParams.get("includeMerged") === "true"
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
  const limit = 25

  const where: any = {}
  if (!includeArchived) where.archived = false
  // A merged record still exists so old links resolve, but it is not a separate person and
  // would otherwise show up as a duplicate in every list.
  if (!includeMerged) where.mergedIntoId = null
  if (q) where.OR = [{ displayName: ci(q) }, { primaryEmail: ci(q) }]

  const [candidates, total] = await Promise.all([
    (prisma as any).candidate.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" },
      include: {
        identities: { select: { kind: true, value: true, verified: true } },
        sources: { select: { source: true, campaign: true, firstSeenAt: true } },
        _count: { select: { applications: true } },
      },
    }),
    (prisma as any).candidate.count({ where }),
  ])

  return NextResponse.json({ candidates, total, pages: Math.ceil(total / limit), viewer: await viewerCapabilities(req) })
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAuthority(req)
  if (!gate.ok) return gate.response
  const auth = gate.authority
  try {
    const body = await req.json()
    const candidateId = String(body?.candidateId || "")
    if (!candidateId) return NextResponse.json({ error: "candidateId is required" }, { status: 400 })

    const before = await (prisma as any).candidate.findUnique({ where: { id: candidateId } })
    if (!before) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    if (before.mergedIntoId) {
      return NextResponse.json({ error: "This record was merged into another. Edit the surviving record instead." }, { status: 409 })
    }

    const data: any = pickFields(body, EDITABLE)
    if (data.displayName === null) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 })
    if (body.archived !== undefined) data.archived = !!body.archived
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    const after = await (prisma as any).candidate.update({ where: { id: candidateId }, data })
    const action = body.archived === true ? "candidate.archive" : body.archived === false ? "candidate.restore" : "candidate.edit"
    await auditAdmin(auth, action, { candidateId, changes: diffRecords(before, after, [...EDITABLE, "archived"]) }, req)
    return NextResponse.json({ success: true, candidate: after })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * Permanent deletion of a candidate master record. Super admin only.
 *
 * This is the erasure path for a sourced person who never held an account: it removes their
 * identifiers and source attribution. Applications are DETACHED rather than deleted — they
 * belong to the employer's hiring record and to the User who submitted them, so destroying
 * them here would silently delete someone else's data.
 */
export async function DELETE(req: NextRequest) {
  const gate = await requireAuthority(req, { destructive: true })
  if (!gate.ok) return gate.response
  const auth = gate.authority
  try {
    const { candidateId, reason } = await req.json()
    if (!candidateId) return NextResponse.json({ error: "candidateId is required" }, { status: 400 })

    const c = await (prisma as any).candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true, displayName: true, primaryEmail: true, userId: true,
        _count: { select: { identities: true, sources: true, applications: true } },
      },
    })
    if (!c) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })

    await auditAdmin(auth, "candidate.delete", {
      candidateId, displayName: c.displayName, linkedUserId: c.userId,
      removed: c._count, detachedApplications: c._count.applications,
      reason: typeof reason === "string" ? reason.slice(0, 300) : null,
    }, req)

    // Applications keep their own userId; only the master link is severed.
    await prisma.application.updateMany({ where: { candidateId }, data: { candidateId: null } })
    await (prisma as any).candidate.delete({ where: { id: candidateId } })

    return NextResponse.json({
      success: true,
      detachedApplications: c._count.applications,
      note: c._count.applications > 0
        ? `${c._count.applications} application(s) were detached, not deleted — they remain part of the employer's hiring record.`
        : undefined,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
