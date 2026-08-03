import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { courseProgressPct, LESSON_TYPES } from "@/lib/learning/course"
import { proficiencyFromEvidence } from "@/lib/learning/competency"
import { newSerial, newVerificationCode } from "@/lib/certificate"

export const dynamic = "force-dynamic"
const canAuthor = (ctx: any) => ctx.has("admin.access") || ctx.has("jobs.post") || ctx.has("ai.ops.view")

async function load(idOrSlug: string) {
  return prisma.course.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: { author: { select: { id: true, name: true } }, lessons: { orderBy: { order: "asc" } } },
  })
}
const jarr = (s?: string | null) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const course = await load(params.id)
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })
  const isAuthor = course.authorId === ctx.userId || ctx.has("admin.access")
  if (course.status !== "PUBLISHED" && !isAuthor) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: ctx.userId, courseId: course.id } }, include: { progress: { select: { lessonId: true } } } })
  const doneIds = new Set((enrollment?.progress || []).map(p => p.lessonId))
  return NextResponse.json({
    course: {
      id: course.id, slug: course.slug, title: course.title, summary: course.summary, level: course.level,
      category: course.category, status: course.status, skills: jarr(course.skills), competencies: jarr(course.competencies),
      author: course.author ? { id: course.author.id, name: course.author.name } : null, isAuthor,
    },
    lessons: course.lessons.map(l => ({ id: l.id, order: l.order, section: l.section, title: l.title, type: l.type, contentMd: l.contentMd, resourceUrl: l.resourceUrl, durationMin: l.durationMin, done: doneIds.has(l.id) })),
    enrollment: enrollment ? { id: enrollment.id, status: enrollment.status, progressPct: enrollment.progressPct, certificateCode: enrollment.certificateCode } : null,
    lessonTypes: LESSON_TYPES,
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const course = await load(params.id)
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })
  const isAuthor = course.authorId === ctx.userId || ctx.has("admin.access")
  const b = await req.json()
  const action = String(b.action || "")

  // ---- authoring ----
  if (action === "add-lesson" || action === "publish" || action === "archive") {
    if (!isAuthor || !canAuthor(ctx)) return NextResponse.json({ error: "Not authorized to edit this course." }, { status: 403 })
    if (action === "add-lesson") {
      const title = String(b.title || "").trim()
      if (!title) return NextResponse.json({ error: "Lesson title required." }, { status: 400 })
      const maxOrder = course.lessons.reduce((m, l) => Math.max(m, l.order), 0)
      const l = await prisma.lesson.create({
        data: {
          courseId: course.id, order: maxOrder + 1, section: b.section ? String(b.section).slice(0, 120) : null,
          title: title.slice(0, 200), type: (LESSON_TYPES as readonly string[]).includes(b.type) ? b.type : "reading",
          contentMd: b.contentMd ? String(b.contentMd).slice(0, 20000) : null,
          resourceUrl: b.resourceUrl ? String(b.resourceUrl).slice(0, 500) : null,
          durationMin: Math.max(1, Math.min(600, Number(b.durationMin) || 10)), skill: b.skill ? String(b.skill).slice(0, 60) : null,
        },
      })
      return NextResponse.json({ success: true, lessonId: l.id })
    }
    if (action === "publish") {
      if (course.lessons.length === 0) return NextResponse.json({ error: "Add at least one lesson before publishing." }, { status: 409 })
      await prisma.course.update({ where: { id: course.id }, data: { status: "PUBLISHED" } })
      return NextResponse.json({ success: true })
    }
    await prisma.course.update({ where: { id: course.id }, data: { status: "ARCHIVED" } })
    return NextResponse.json({ success: true })
  }

  // ---- learner: enroll ----
  if (action === "enroll") {
    if (course.status !== "PUBLISHED" && !isAuthor) return NextResponse.json({ error: "Course not available." }, { status: 409 })
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: ctx.userId, courseId: course.id } },
      create: { userId: ctx.userId, courseId: course.id, status: "ACTIVE", progressPct: 0 },
      update: {},
    })
    return NextResponse.json({ success: true })
  }

  // ---- learner: complete a lesson (→ progress, and on full completion a cert + competency evidence) ----
  if (action === "complete-lesson") {
    const lessonId = String(b.lessonId || "")
    const lesson = course.lessons.find(l => l.id === lessonId)
    if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 })
    const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: ctx.userId, courseId: course.id } } })
    if (!enrollment) return NextResponse.json({ error: "Enroll first." }, { status: 409 })

    await prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
      create: { enrollmentId: enrollment.id, lessonId }, update: {},
    })
    const total = course.lessons.length
    const doneCount = await prisma.lessonProgress.count({ where: { enrollmentId: enrollment.id } })
    const pct = courseProgressPct(total, doneCount)
    // Completion is COUNT-based (every lesson done) — never a rounding artefact.
    const complete = total > 0 && doneCount >= total

    // Already completed: refresh progress only. NEVER downgrade a completed enrollment or
    // re-issue a certificate (adding a lesson later can't revoke a past completion).
    if (enrollment.status === "COMPLETED") {
      await prisma.enrollment.update({ where: { id: enrollment.id }, data: { progressPct: pct } }).catch(() => {})
      return NextResponse.json({ success: true, progressPct: pct, complete: true, certificateCode: enrollment.certificateCode })
    }

    if (complete) {
      // Atomically CLAIM completion — only the first request that flips ACTIVE→COMPLETED
      // issues the certificate + evidence (fixes replay/concurrency double-issuance).
      const code = newVerificationCode()
      const claimed = await prisma.enrollment.updateMany({
        where: { id: enrollment.id, status: { not: "COMPLETED" } },
        data: { status: "COMPLETED", completedAt: new Date(), progressPct: 100, certificateCode: code },
      })
      if (claimed.count !== 1) {
        const cur = await prisma.enrollment.findUnique({ where: { id: enrollment.id }, select: { certificateCode: true } })
        return NextResponse.json({ success: true, progressPct: 100, complete: true, certificateCode: cur?.certificateCode })
      }
      await prisma.certificate.create({
        data: {
          userId: ctx.userId, issuedById: course.authorId, title: `Completed: ${course.title}`, kind: "course",
          serial: newSerial(), verificationCode: code, issuerName: course.author?.name || "Vrittih Academy",
          skills: jarr(course.skills).join(", ") || null, note: "Course completion",
        },
      }).catch(() => {})
      // Competency evidence: course completion is a real (mid-strength) signal.
      const courseSignal = proficiencyFromEvidence([{ source: "course", score: 1 }])
      for (const key of jarr(course.competencies)) {
        const existing = await prisma.userCompetency.findUnique({ where: { userId_competencyKey: { userId: ctx.userId, competencyKey: String(key) } }, select: { proficiency: true } }).catch(() => null)
        const next = Math.max(existing?.proficiency || 0, courseSignal)
        await prisma.userCompetency.upsert({
          where: { userId_competencyKey: { userId: ctx.userId, competencyKey: String(key) } },
          create: { userId: ctx.userId, competencyKey: String(key), proficiency: next, source: "course", evidenceRef: course.id, assessedAt: new Date() },
          update: { proficiency: next, source: "course", evidenceRef: course.id, assessedAt: new Date() },
        }).catch(() => {})
      }
      return NextResponse.json({ success: true, progressPct: 100, complete: true, certificateCode: code })
    }

    // Not complete: advance progress only, keep ACTIVE (never set completedAt).
    await prisma.enrollment.update({ where: { id: enrollment.id }, data: { progressPct: pct } }).catch(() => {})
    return NextResponse.json({ success: true, progressPct: pct, complete: false })
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
