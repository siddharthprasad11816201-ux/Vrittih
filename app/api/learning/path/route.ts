import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { assemblePath } from "@/lib/learning/course"

export const dynamic = "force-dynamic"

/* ELTOS Module 3 — Learning Path Engine. Given a target (explicit skills or a visible
 * JobTemplate's required competencies), assemble an ordered, gap‑closing sequence of
 * published courses. Deterministic + honest about what remains uncovered. */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()

  let targetSkills: string[] = Array.isArray(b.skills) ? b.skills.map((s: any) => String(s)).filter(Boolean) : []
  let sourceLabel = "your target skills"

  if (b.templateId) {
    const tpl = await prisma.jobTemplate.findUnique({ where: { id: String(b.templateId) }, select: { title: true, requiredCompetencies: true, status: true, createdById: true } }).catch(() => null)
    if (tpl && (tpl.status === "APPROVED" || tpl.createdById === ctx.userId || ctx.has("admin.access"))) {
      const compKeys: string[] = (() => { try { return (JSON.parse(tpl.requiredCompetencies || "[]") as any[]).map(c => c.key) } catch { return [] } })()
      if (compKeys.length) {
        const comps = await prisma.competency.findMany({ where: { key: { in: compKeys } }, select: { skills: true } })
        const set = new Set(targetSkills)
        for (const c of comps) { try { for (const s of JSON.parse(c.skills || "[]")) set.add(String(s)) } catch {} }
        targetSkills = Array.from(set)
        sourceLabel = `the "${tpl.title}" role`
      }
    }
  }
  if (!targetSkills.length) return NextResponse.json({ error: "Provide target skills or a role template." }, { status: 400 })

  const courses = await prisma.course.findMany({
    where: { status: "PUBLISHED" }, select: { id: true, slug: true, title: true, level: true, skills: true }, take: 300,
  })
  const courseLikes = courses.map(c => ({ id: c.id, slug: c.slug, title: c.title, level: c.level, skills: (() => { try { return JSON.parse(c.skills || "[]") } catch { return [] } })() }))
  const { steps, uncovered } = assemblePath(targetSkills, courseLikes)

  return NextResponse.json({
    source: sourceLabel,
    targetSkills,
    steps: steps.map(s => ({ order: s.order, courseId: s.course.id, slug: (s.course as any).slug, title: (s.course as any).title, level: (s.course as any).level, newlyCovers: s.newlyCovers })),
    uncovered,
    note: uncovered.length ? `${uncovered.length} target skill(s) have no course yet — flagged honestly.` : "This path covers your full target.",
  })
}
