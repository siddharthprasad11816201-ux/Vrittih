import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAction } from "@/lib/admin"
import { isValidStatus } from "@/lib/social/engage"

export const dynamic = "force-dynamic"

// Moderation queue. Default view is the OPEN reports, newest first, with the reported
// content resolved so a moderator can judge without extra lookups.
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const status = new URL(req.url).searchParams.get("status") || "OPEN"
  if (!isValidStatus(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 })

  const reports = await (prisma as any).report.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  // Resolve reporters and targets in bulk.
  const reporterIds = [...new Set(reports.map((r: any) => r.reporterId))] as string[]
  const reporters = reporterIds.length
    ? await prisma.user.findMany({ where: { id: { in: reporterIds } }, select: { id: true, name: true, email: true } })
    : []
  const reporterMap = Object.fromEntries(reporters.map((u) => [u.id, u]))

  const postIds = reports.filter((r: any) => r.targetType === "post").map((r: any) => r.targetId)
  const userIds = reports.filter((r: any) => r.targetType === "user").map((r: any) => r.targetId)
  const posts = postIds.length ? await prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, content: true, authorId: true } }) : []
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, banned: true } }) : []
  const postMap = Object.fromEntries(posts.map((p) => [p.id, p]))
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  // Company reviews awaiting moderation ride in the same queue — one place to review
  // everything that gates public content.
  const pendingReviews = status === "OPEN"
    ? await (prisma as any).companyReview.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 50 })
    : []

  return NextResponse.json({
    status,
    pendingReviews: pendingReviews.map((r: any) => ({
      id: r.id, companyId: r.companyId, authorId: r.authorId, rating: r.rating,
      title: r.title, pros: r.pros, cons: r.cons, createdAt: r.createdAt,
    })),
    count: reports.length,
    reports: reports.map((r: any) => ({
      id: r.id, targetType: r.targetType, targetId: r.targetId, reason: r.reason, detail: r.detail,
      status: r.status, createdAt: r.createdAt, resolution: r.resolution, resolvedAt: r.resolvedAt,
      reporter: reporterMap[r.reporterId] || { id: r.reporterId },
      target: r.targetType === "post" ? postMap[r.targetId] || null : r.targetType === "user" ? userMap[r.targetId] || null : null,
    })),
  })
}

// Resolve or dismiss a report, optionally acting on the content (delete post / ban user).
export async function PATCH(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  try {
    const body = await req.json()
    const id = String(body?.id || "")
    const status = String(body?.status || "")
    const action = String(body?.action || "none")   // none | delete_post | ban_user
    const resolution = typeof body?.resolution === "string" ? body.resolution.trim().slice(0, 500) : null
    if (status !== "RESOLVED" && status !== "DISMISSED") {
      return NextResponse.json({ error: "status must be RESOLVED or DISMISSED" }, { status: 400 })
    }
    if (!id && !body?.reviewId) return NextResponse.json({ error: "id or reviewId is required" }, { status: 400 })

    // Reviewing a company review rather than a report: { reviewId, status }.
    const reviewId = String(body?.reviewId || "")
    if (reviewId) {
      const publish = status === "RESOLVED"
      const upd = await (prisma as any).companyReview.updateMany({
        where: { id: reviewId, status: "PENDING" },
        data: { status: publish ? "PUBLISHED" : "REJECTED" },
      })
      if (!upd.count) return NextResponse.json({ error: "Review not found or already moderated" }, { status: 404 })
      await logAction(admin.userId, "moderation.review", { reviewId, published: publish }, req)
      return NextResponse.json({ ok: true, published: publish })
    }

    const report = await (prisma as any).report.findUnique({ where: { id } })
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 })

    // Enforcement is explicit and audited — never implied by the status alone.
    let enforced = "none"
    if (action === "delete_post" && report.targetType === "post") {
      await prisma.post.deleteMany({ where: { id: report.targetId } })
      enforced = "delete_post"
    } else if (action === "ban_user" && report.targetType === "user") {
      await prisma.user.updateMany({ where: { id: report.targetId }, data: { banned: true } })
      enforced = "ban_user"
    }

    await (prisma as any).report.update({
      where: { id },
      data: { status, resolution, resolvedById: admin.userId, resolvedAt: new Date() },
    })
    await logAction(admin.userId, "moderation.resolve", { reportId: id, status, enforced }, req)
    return NextResponse.json({ ok: true, enforced })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
