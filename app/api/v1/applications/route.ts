import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authApiKey } from "@/lib/apikey"

export const dynamic = "force-dynamic"

/* Partner API — read applicants back into the company's own tools (HRMS/ATS).
 * GET /api/v1/applications
 *   ?jobId=…      only this job (must belong to the caller)
 *   ?status=…     APPLIED | SCREENING | INTERVIEW | OFFER | HIRED | REJECTED …
 *   ?since=ISO    only applications on/after this time
 *   ?limit=50     1..200
 *   ?cursor=id    id of the last item from the previous page
 * Auth: Authorization: Bearer vk_live_… (scopes results to that company's jobs).
 * The applicant view is the snapshot frozen at submit — what the company was
 * actually sent — plus screening answers, documents and the status timeline. */

function parseSnapshot(s: string | null): any {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

function shape(a: any) {
  const snap = parseSnapshot(a.snapshot) || {}
  return {
    id: a.id,
    jobId: a.jobId,
    jobTitle: a.job?.title || null,
    status: a.status,
    appliedAt: a.appliedAt,
    updatedAt: a.updatedAt,
    source: a.source || "vrittih",
    applicant: {
      name: snap.name || a.user?.name || null,
      email: snap.email || a.user?.email || null,
      phone: snap.phone || null,
      location: snap.location || null,
      headline: snap.headline || null,
      experience: Array.isArray(snap.experience) ? snap.experience : [],
      education: Array.isArray(snap.education) ? snap.education : [],
      skills: Array.isArray(snap.skills) ? snap.skills : [],
    },
    coverLetter: a.coverLetter || null,
    resumeUrl: a.resumeUrl || null,
    answers: (a.answers || []).map((x: any) => ({ questionId: x.questionId, label: x.label, value: x.value })),
    documents: (a.documents || []).map((d: any) => ({ slotId: d.slotId, label: d.label, filename: d.filename, mediaId: d.mediaId })),
    timeline: (a.timeline || []).map((t: any) => ({ status: t.status, note: t.note, at: t.createdAt })),
  }
}

export async function GET(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key. Use 'Authorization: Bearer vk_live_…'." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get("jobId") || undefined
  const status = searchParams.get("status") || undefined
  const sinceRaw = searchParams.get("since")
  const since = sinceRaw ? new Date(sinceRaw) : null
  if (sinceRaw && isNaN(since!.getTime())) return NextResponse.json({ error: "Invalid 'since' — use an ISO date." }, { status: 400 })
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 200)
  const cursor = searchParams.get("cursor") || undefined

  const where: any = { job: { postedById: ctx.employerId } }
  if (jobId) where.jobId = jobId
  if (status) where.status = status.toUpperCase()
  if (since) where.appliedAt = { gte: since }

  const rows = await prisma.application.findMany({
    where,
    orderBy: [{ appliedAt: "desc" }, { id: "desc" }],
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, jobId: true, status: true, coverLetter: true, appliedAt: true, updatedAt: true, snapshot: true, resumeUrl: true, source: true,
      job: { select: { title: true } },
      user: { select: { name: true, email: true } },
      answers: { select: { questionId: true, label: true, value: true } },
      documents: { select: { slotId: true, label: true, filename: true, mediaId: true } },
      timeline: { select: { status: true, note: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  })

  const applications = rows.map(shape)
  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null
  return NextResponse.json({ count: applications.length, applications, nextCursor })
}
