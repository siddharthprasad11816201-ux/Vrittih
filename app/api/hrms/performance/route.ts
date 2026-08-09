import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { okrProgress, reviewRollup, ratingToProficiency, GOAL_STATUSES } from "@/lib/hrms/performance"
import { createNotification } from "@/lib/notify"

export const dynamic = "force-dynamic"
const isManager = (ctx: any) => ctx.has("hrms.view") || ctx.has("admin.access")
const jarr = (s?: string | null) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }

async function resolveUser(idOrEmail: string): Promise<string | null> {
  if (!idOrEmail) return null
  if (idOrEmail.includes("@")) { const u = await prisma.user.findUnique({ where: { email: idOrEmail.toLowerCase() }, select: { id: true } }); return u?.id || null }
  const u = await prisma.user.findUnique({ where: { id: idOrEmail }, select: { id: true } }); return u?.id || null
}
// A manager may only act on their OWN company's employees (never an arbitrary platform user).
async function isMyEmployee(userId: string, employerId: string): Promise<boolean> {
  return !!(await prisma.employee.findUnique({ where: { employerId_userId: { employerId, userId } }, select: { userId: true } }).catch(() => null))
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const [goals, reviews, oneOnOnes, recognition, myDraftReviews] = await Promise.all([
    prisma.goal.findMany({ where: { ownerId: ctx.userId }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.performanceReview.findMany({ where: { subjectId: ctx.userId, status: { in: ["SUBMITTED", "ACKNOWLEDGED"] } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.oneOnOne.findMany({ where: { OR: [{ managerId: ctx.userId }, { employeeId: ctx.userId }] }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.recognition.findMany({ where: { toId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    isManager(ctx) ? prisma.performanceReview.findMany({ where: { reviewerId: ctx.userId, status: "DRAFT" }, orderBy: { createdAt: "desc" }, take: 50 }) : Promise.resolve([] as any[]),
  ])
  // resolve names for the display of counterparties
  const ids = Array.from(new Set([...reviews.map(r => r.reviewerId), ...oneOnOnes.map(o => o.managerId === ctx.userId ? o.employeeId : o.managerId), ...recognition.map(r => r.fromId), ...myDraftReviews.map(r => r.subjectId)]))
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []
  const nameById = new Map(users.map(u => [u.id, u.name]))

  return NextResponse.json({
    goals: goals.map(g => ({ id: g.id, title: g.title, description: g.description, keyResults: jarr(g.keyResults), progress: g.progress, period: g.period, status: g.status })),
    reviews: reviews.map(r => ({ id: r.id, period: r.period, overall: r.overall, summary: r.summary, status: r.status, reviewer: nameById.get(r.reviewerId), ratings: jarr(r.ratingsJson), rollup: reviewRollup(jarr(r.ratingsJson)) })),
    oneOnOnes: oneOnOnes.map(o => ({ id: o.id, notes: o.notes, scheduledAt: o.scheduledAt, with: nameById.get(o.managerId === ctx.userId ? o.employeeId : o.managerId), asManager: o.managerId === ctx.userId })),
    recognition: recognition.map(r => ({ id: r.id, message: r.message, badge: r.badge, from: nameById.get(r.fromId), createdAt: r.createdAt })),
    draftReviews: myDraftReviews.map(r => ({ id: r.id, subject: nameById.get(r.subjectId), period: r.period, ratings: jarr(r.ratingsJson) })),
    isManager: isManager(ctx),
  })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const action = String(b.action || "")

  if (action === "create-goal") {
    const title = String(b.title || "").trim()
    if (!title) return NextResponse.json({ error: "Goal title required." }, { status: 400 })
    const krs = Array.isArray(b.keyResults) ? b.keyResults.slice(0, 10).map((k: any) => ({ text: String(k.text || "").slice(0, 200), target: Number(k.target) || 0, current: Number(k.current) || 0, unit: k.unit ? String(k.unit).slice(0, 20) : undefined })) : []
    const g = await prisma.goal.create({ data: { ownerId: ctx.userId, createdById: ctx.userId, title: title.slice(0, 200), description: b.description ? String(b.description).slice(0, 2000) : null, keyResults: JSON.stringify(krs), progress: okrProgress(krs), period: b.period ? String(b.period).slice(0, 40) : null, status: "ACTIVE" } })
    return NextResponse.json({ success: true, id: g.id }, { status: 201 })
  }

  if (action === "update-goal") {
    const g = await prisma.goal.findUnique({ where: { id: String(b.id || "") }, select: { ownerId: true } })
    if (!g || g.ownerId !== ctx.userId) return NextResponse.json({ error: "Not your goal." }, { status: 403 })
    const data: any = {}
    if (Array.isArray(b.keyResults)) { const krs = b.keyResults.slice(0, 10).map((k: any) => ({ text: String(k.text || "").slice(0, 200), target: Number(k.target) || 0, current: Number(k.current) || 0, unit: k.unit })); data.keyResults = JSON.stringify(krs); data.progress = okrProgress(krs) }
    if (b.status && (GOAL_STATUSES as readonly string[]).includes(b.status)) data.status = b.status
    await prisma.goal.update({ where: { id: String(b.id) }, data })
    return NextResponse.json({ success: true })
  }

  if (action === "recognize") {
    const toId = await resolveUser(String(b.to || ""))
    if (!toId) return NextResponse.json({ error: "Recipient not found." }, { status: 404 })
    if (toId === ctx.userId) return NextResponse.json({ error: "You can't recognize yourself." }, { status: 400 })
    const message = String(b.message || "").trim()
    if (!message) return NextResponse.json({ error: "A message is required." }, { status: 400 })
    await prisma.recognition.create({ data: { fromId: ctx.userId, toId, message: message.slice(0, 1000), badge: b.badge ? String(b.badge).slice(0, 40) : null } })
    await createNotification({ userId: toId, title: "You were recognised", body: message.slice(0, 140), link: "/hrms/performance", sendEmail: false }).catch(() => {})
    return NextResponse.json({ success: true }, { status: 201 })
  }

  // ---- manager-only from here ----
  if (!isManager(ctx)) return NextResponse.json({ error: "Manager/HR access required." }, { status: 403 })

  if (action === "create-review") {
    const subjectId = await resolveUser(String(b.subject || ""))
    if (!subjectId) return NextResponse.json({ error: "Subject not found." }, { status: 404 })
    if (subjectId === ctx.userId) return NextResponse.json({ error: "You can't review yourself." }, { status: 400 })
    if (!(await isMyEmployee(subjectId, ctx.userId))) return NextResponse.json({ error: "You can only review your own team members." }, { status: 403 })
    const ratings = Array.isArray(b.ratings) ? b.ratings.filter((r: any) => r.competencyKey).map((r: any) => ({ competencyKey: String(r.competencyKey).slice(0, 60), rating: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0))) })) : []
    const rv = await prisma.performanceReview.create({ data: { subjectId, reviewerId: ctx.userId, period: b.period ? String(b.period).slice(0, 40) : null, ratingsJson: JSON.stringify(ratings), overall: Math.round(reviewRollup(ratings).overall), summary: b.summary ? String(b.summary).slice(0, 5000) : null, status: "DRAFT" } })
    return NextResponse.json({ success: true, id: rv.id }, { status: 201 })
  }

  if (action === "submit-review") {
    const rv = await prisma.performanceReview.findUnique({ where: { id: String(b.id || "") } })
    if (!rv) return NextResponse.json({ error: "Review not found." }, { status: 404 })
    if (rv.reviewerId !== ctx.userId && !ctx.has("admin.access")) return NextResponse.json({ error: "Only the reviewer can submit." }, { status: 403 })
    if (rv.status !== "DRAFT") return NextResponse.json({ error: "Already submitted." }, { status: 409 })
    await prisma.performanceReview.update({ where: { id: rv.id }, data: { status: "SUBMITTED" } })
    // Competency evidence: a review rating is a strong signal for the subject.
    for (const r of jarr(rv.ratingsJson)) {
      const key = String(r.competencyKey || ""); if (!key) continue
      const prof = ratingToProficiency(Number(r.rating) || 0)
      const existing = await prisma.userCompetency.findUnique({ where: { userId_competencyKey: { userId: rv.subjectId, competencyKey: key } }, select: { proficiency: true } }).catch(() => null)
      await prisma.userCompetency.upsert({ where: { userId_competencyKey: { userId: rv.subjectId, competencyKey: key } }, create: { userId: rv.subjectId, competencyKey: key, proficiency: prof, source: "review", evidenceRef: rv.id }, update: { proficiency: Math.max(existing?.proficiency || 0, prof), source: "review", evidenceRef: rv.id, assessedAt: new Date() } }).catch(() => {})
    }
    await createNotification({ userId: rv.subjectId, title: "Your performance review is ready", body: "A performance review has been shared with you.", link: "/hrms/performance", sendEmail: false }).catch(() => {})
    return NextResponse.json({ success: true })
  }

  if (action === "schedule-1on1") {
    const employeeId = await resolveUser(String(b.employee || ""))
    if (!employeeId) return NextResponse.json({ error: "Employee not found." }, { status: 404 })
    if (!(await isMyEmployee(employeeId, ctx.userId))) return NextResponse.json({ error: "You can only schedule 1:1s with your own team members." }, { status: 403 })
    await prisma.oneOnOne.create({ data: { managerId: ctx.userId, employeeId, notes: b.notes ? String(b.notes).slice(0, 4000) : null, scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : null } })
    await createNotification({ userId: employeeId, title: "1:1 scheduled", body: "Your manager scheduled a 1:1.", link: "/hrms/performance", sendEmail: false }).catch(() => {})
    return NextResponse.json({ success: true }, { status: 201 })
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
