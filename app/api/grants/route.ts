import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { createNotification } from "@/lib/notify"

export const dynamic = "force-dynamic"
const canPost = (ctx: any) => ctx.has("admin.access") || ctx.has("jobs.post") || ctx.has("ai.ops.view")
const APP_STATUS = ["SUBMITTED", "SHORTLISTED", "AWARDED", "REJECTED"]

/* Phase 3 Module 6 — Grant Management. Anyone can browse open grants + apply; funders/
 * admins post grants and advance applications. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const [open, mineApps, posted] = await Promise.all([
    prisma.grant.findMany({ where: { status: "OPEN" }, include: { postedBy: { select: { name: true } }, _count: { select: { applications: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.grantApplication.findMany({ where: { applicantId: ctx.userId }, include: { grant: { select: { title: true, funder: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    canPost(ctx) ? prisma.grant.findMany({ where: { postedById: ctx.userId }, include: { applications: { include: { applicant: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 }) : Promise.resolve([] as any[]),
  ])
  const appliedSet = new Set(mineApps.map(a => a.grantId))
  return NextResponse.json({
    open: open.map(g => ({ id: g.id, title: g.title, funder: g.funder, amount: g.amount, currency: g.currency, field: g.field, deadline: g.deadline, description: g.description, applications: g._count.applications, postedBy: g.postedBy?.name, applied: appliedSet.has(g.id) })),
    myApplications: mineApps.map(a => ({ id: a.id, status: a.status, grant: a.grant?.title, funder: a.grant?.funder })),
    posted: posted.map((g: any) => ({ id: g.id, title: g.title, status: g.status, applications: (g.applications || []).map((a: any) => ({ id: a.id, applicant: a.applicant?.name, status: a.status, summary: a.summary })) })),
    canPost: canPost(ctx),
  })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  if (b.action === "apply") {
    const grant = await prisma.grant.findUnique({ where: { id: String(b.grantId || "") }, select: { id: true, status: true, postedById: true, title: true } })
    if (!grant || grant.status !== "OPEN") return NextResponse.json({ error: "Grant not open." }, { status: 409 })
    const dupe = await prisma.grantApplication.findFirst({ where: { grantId: grant.id, applicantId: ctx.userId } })
    if (dupe) return NextResponse.json({ error: "You already applied." }, { status: 409 })
    await prisma.grantApplication.create({ data: { grantId: grant.id, applicantId: ctx.userId, projectId: b.projectId || null, summary: b.summary ? String(b.summary).slice(0, 4000) : null, status: "SUBMITTED" } })
    await createNotification({ userId: grant.postedById, title: `New grant application — ${grant.title}`, body: "A researcher applied to your grant.", link: "/innovation", sendEmail: false }).catch(() => {})
    return NextResponse.json({ success: true }, { status: 201 })
  }
  // post a grant
  if (!canPost(ctx)) return NextResponse.json({ error: "Posting grants requires funder/admin access." }, { status: 403 })
  const title = String(b.title || "").trim()
  if (!title) return NextResponse.json({ error: "Grant title required." }, { status: 400 })
  const g = await prisma.grant.create({ data: { postedById: ctx.userId, title: title.slice(0, 240), funder: b.funder ? String(b.funder).slice(0, 160) : null, amount: Number(b.amount) > 0 ? Number(b.amount) : null, currency: String(b.currency || "CHF").slice(0, 8).toUpperCase(), field: b.field ? String(b.field).slice(0, 80) : null, description: b.description ? String(b.description).slice(0, 5000) : null, deadline: b.deadline ? new Date(b.deadline) : null, status: "OPEN" } })
  return NextResponse.json({ success: true, id: g.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const status = String(b.status || "").toUpperCase()
  if (!APP_STATUS.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
  const app = await prisma.grantApplication.findUnique({ where: { id: String(b.id || "") }, include: { grant: { select: { postedById: true } } } })
  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 })
  if (app.grant.postedById !== ctx.userId && !ctx.has("admin.access")) return NextResponse.json({ error: "Only the grant owner may decide." }, { status: 403 })
  await prisma.grantApplication.update({ where: { id: app.id }, data: { status } })
  await createNotification({ userId: app.applicantId, title: `Grant application ${status.toLowerCase()}`, body: `Your grant application was ${status.toLowerCase()}.`, link: "/innovation", sendEmail: false }).catch(() => {})
  return NextResponse.json({ success: true })
}
