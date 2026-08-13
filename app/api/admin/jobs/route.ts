import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ci } from "@/lib/db"
import { logAction } from "@/lib/admin"
import { requireAuthority, viewerCapabilities } from "@/lib/admin/authority"
import { safeExternalUrl } from "@/lib/url"

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAuthority(req)
    if (!gate.ok) return gate.response
    const admin = gate.authority
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = 20
    const where: any = {}
    if (q) where.OR = [{ title:ci(q) },{ company:ci(q) }]
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where, skip:(page-1)*limit, take:limit,
        orderBy:{ createdAt:"desc" },
        include:{ postedBy:{ select:{ id:true,name:true,email:true,idVerified:true } }, _count:{ select:{ applications:true } } },
      }),
      prisma.job.count({ where }),
    ])
    return NextResponse.json({ jobs, total, pages: Math.ceil(total/limit), viewer: await viewerCapabilities(req) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Edit a posting and/or archive it. Previously this ONLY toggled `active`, so an admin
// could not correct a bad listing at all — and nothing was audited.
const EDITABLE = ["title", "company", "location", "type", "industry", "salary", "description", "experienceLevel"] as const
const TYPES = ["FULLTIME", "PARTTIME", "INTERNSHIP", "CONTRACT", "FREELANCE"]

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireAuthority(req)
    if (!gate.ok) return gate.response
    const admin = gate.authority
    const body = await req.json()
    const jobId = String(body?.jobId || "")
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 })

    const before = await prisma.job.findUnique({ where: { id: jobId } })
    if (!before) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const data: any = {}
    for (const key of EDITABLE) {
      if (body[key] === undefined) continue
      const v = typeof body[key] === "string" ? body[key].trim() : body[key]
      if (key === "title" && !v) return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 })
      if (key === "type" && v && !TYPES.includes(String(v).toUpperCase())) {
        return NextResponse.json({ error: `type must be one of: ${TYPES.join(", ")}.` }, { status: 400 })
      }
      data[key] = key === "type" ? String(v).toUpperCase() : (v === "" ? null : v)
    }
    if (body.remote !== undefined) data.remote = !!body.remote
    if (body.active !== undefined) data.active = !!body.active
    if (body.applyUrl !== undefined) data.applyUrl = safeExternalUrl(body.applyUrl)
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    const job = await prisma.job.update({ where: { id: jobId }, data })

    // Record WHAT changed, not just that something did — an audit entry that cannot answer
    // "what was it before?" is close to useless during an incident.
    const changes: Record<string, { from: any; to: any }> = {}
    for (const k of Object.keys(data)) {
      if ((before as any)[k] !== (job as any)[k]) changes[k] = { from: (before as any)[k], to: (job as any)[k] }
    }
    await logAction(admin.userId, body.active === false ? "job.archive" : body.active === true ? "job.restore" : "job.edit",
      { jobId, changes }, req)

    return NextResponse.json({ success: true, job })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Permanent deletion. SUPER_ADMIN only: this destroys the posting AND cascades to every
// application submitted to it, which is unrecoverable. Archiving is the reversible option
// and is what the UI offers first.
export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireAuthority(req, { destructive: true })
    if (!gate.ok) return gate.response
    const admin = gate.authority
    const { jobId } = await req.json()
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 })

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, company: true, postedById: true, _count: { select: { applications: true } } },
    })
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    // Snapshot BEFORE the row disappears, so the trail survives the deletion.
    await logAction(admin.userId, "job.delete",
      { jobId, title: job.title, company: job.company, postedById: job.postedById, applicationsDestroyed: job._count.applications }, req)

    await prisma.job.delete({ where: { id: jobId } })
    return NextResponse.json({ success: true, deletedApplications: job._count.applications })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}