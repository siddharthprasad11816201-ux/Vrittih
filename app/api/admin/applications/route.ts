import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthority, viewerCapabilities, auditAdmin } from "@/lib/admin/authority"
import { checkStageTransition, APPLICATION_STAGES } from "@/lib/interview/state"

export const dynamic = "force-dynamic"

/**
 * Admin view of applications across every employer.
 *
 * Note what an admin deliberately CANNOT do here: skip the pipeline. Stage changes still go
 * through the same state machine every recruiter uses, so an application cannot jump from
 * APPLIED to HIRED just because an administrator asked. The audit trail would otherwise
 * record a history that never happened.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAuthority(req)
  if (!gate.ok) return gate.response
  const auth = gate.authority

  const url = new URL(req.url)
  const status = url.searchParams.get("status") || ""
  const jobId = url.searchParams.get("jobId") || ""
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
  const limit = 25

  const where: any = {}
  if (status && (APPLICATION_STAGES as readonly string[]).includes(status)) where.status = status
  if (jobId) where.jobId = jobId

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { appliedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        job: { select: { id: true, title: true, company: true, postedById: true } },
        _count: { select: { timeline: true, documents: true } },
      },
    }),
    prisma.application.count({ where }),
  ])

  return NextResponse.json({
    applications, total, pages: Math.ceil(total / limit),
    stages: APPLICATION_STAGES,
    viewer: await viewerCapabilities(req),
  })
}

// Move an application's stage, as an admin, through the SAME legality rules as everyone.
export async function PATCH(req: NextRequest) {
  const gate = await requireAuthority(req)
  if (!gate.ok) return gate.response
  const auth = gate.authority
  try {
    const body = await req.json()
    const applicationId = String(body?.applicationId || "")
    const status = String(body?.status || "")
    if (!applicationId || !status) return NextResponse.json({ error: "applicationId and status are required" }, { status: 400 })

    const before = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true, userId: true, jobId: true },
    })
    if (!before) return NextResponse.json({ error: "Application not found" }, { status: 404 })

    const check = checkStageTransition(before.status, status, "ADMIN")
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 })

    // Status-conditional so an admin and a recruiter acting at once cannot both win.
    const moved = await prisma.application.updateMany({
      where: { id: applicationId, status: before.status },
      data: { status, updatedAt: new Date() },
    })
    if (!moved.count) {
      return NextResponse.json({ error: "This application was just updated by someone else. Reload and retry." }, { status: 409 })
    }
    await prisma.statusEvent.create({
      data: { applicationId, status, note: typeof body?.note === "string" ? body.note.slice(0, 500) : "Changed by an administrator" },
    }).catch(() => {})

    await auditAdmin(auth, "application.stage", { applicationId, from: before.status, to: status }, req)
    return NextResponse.json({ success: true, from: before.status, to: status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * Permanent deletion. Super admin only.
 *
 * An application is a person's submission — deleting it also destroys their timeline,
 * answers and uploaded documents. It exists mainly to satisfy an erasure request, so the
 * audit records who asked and what was destroyed.
 */
export async function DELETE(req: NextRequest) {
  const gate = await requireAuthority(req, { destructive: true })
  if (!gate.ok) return gate.response
  const auth = gate.authority
  try {
    const { applicationId, reason } = await req.json()
    if (!applicationId) return NextResponse.json({ error: "applicationId is required" }, { status: 400 })

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true, userId: true, jobId: true, status: true, appliedAt: true,
        job: { select: { title: true, company: true } },
        _count: { select: { timeline: true, documents: true, answers: true } },
      },
    })
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 })

    await auditAdmin(auth, "application.delete", {
      applicationId, candidateId: app.userId, jobTitle: app.job?.title, company: app.job?.company,
      stage: app.status, destroyed: app._count, reason: typeof reason === "string" ? reason.slice(0, 300) : null,
    }, req)

    await prisma.application.delete({ where: { id: applicationId } })
    return NextResponse.json({ success: true, destroyed: app._count })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
