import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { LESSON_TYPES } from "@/lib/learning/course"

export const dynamic = "force-dynamic"
const canAuthor = (ctx: any) => ctx.has("admin.access") || ctx.has("jobs.post") || ctx.has("ai.ops.view")
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)

function shape(c: any, enrolledSet?: Set<string>) {
  return {
    id: c.id, slug: c.slug, title: c.title, summary: c.summary, level: c.level, category: c.category, status: c.status,
    skills: (() => { try { return JSON.parse(c.skills || "[]") } catch { return [] } })(),
    competencies: (() => { try { return JSON.parse(c.competencies || "[]") } catch { return [] } })(),
    lessonCount: c._count?.lessons ?? c.lessons?.length ?? 0,
    author: c.author ? { id: c.author.id, name: c.author.name } : null,
    enrolled: enrolledSet ? enrolledSet.has(c.id) : undefined,
  }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const [published, myEnroll, mine] = await Promise.all([
    prisma.course.findMany({ where: { status: "PUBLISHED" }, include: { author: { select: { id: true, name: true } }, _count: { select: { lessons: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.enrollment.findMany({ where: { userId: ctx.userId }, include: { course: { select: { id: true, slug: true, title: true, category: true, _count: { select: { lessons: true } } } } }, orderBy: { startedAt: "desc" } }),
    canAuthor(ctx) ? prisma.course.findMany({ where: { authorId: ctx.userId }, include: { _count: { select: { lessons: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }) : Promise.resolve([] as any[]),
  ])
  const enrolledSet = new Set(myEnroll.map(e => e.courseId))
  return NextResponse.json({
    courses: published.map(c => shape(c, enrolledSet)),
    enrollments: myEnroll.map(e => ({ id: e.id, courseId: e.courseId, status: e.status, progressPct: e.progressPct, certificateCode: e.certificateCode, course: { title: e.course?.title, slug: e.course?.slug, lessonCount: e.course?._count?.lessons ?? 0 } })),
    mine: mine.map((c: any) => shape(c)),
    canAuthor: canAuthor(ctx),
    lessonTypes: LESSON_TYPES,
  })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canAuthor(ctx)) return NextResponse.json({ error: "Authoring courses requires instructor access." }, { status: 403 })
  const b = await req.json()
  const title = String(b.title || "").trim()
  if (!title) return NextResponse.json({ error: "A course title is required." }, { status: 400 })
  const slug = (slugify(title) || "course") + "-" + Math.random().toString(36).slice(2, 6)
  const c = await prisma.course.create({
    data: {
      slug, authorId: ctx.userId, title: title.slice(0, 200),
      summary: b.summary ? String(b.summary).slice(0, 2000) : null,
      level: String(b.level || "MID").toUpperCase(), category: b.category ? String(b.category).slice(0, 40) : null,
      skills: JSON.stringify(Array.isArray(b.skills) ? b.skills.slice(0, 40).map((s: any) => String(s)) : []),
      competencies: JSON.stringify(Array.isArray(b.competencies) ? b.competencies.slice(0, 40).map((s: any) => String(s)) : []),
      status: "DRAFT",
    },
  })
  return NextResponse.json({ success: true, id: c.id, slug: c.slug }, { status: 201 })
}
