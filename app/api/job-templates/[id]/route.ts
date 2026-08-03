import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { canTransition, type TemplateAction } from "@/lib/jobarch/lifecycle"
import { generateJD, competenciesFor } from "@/lib/jobarch/jd"

export const dynamic = "force-dynamic"
const canManage = (ctx: any) => ctx.has("jobs.post") || ctx.has("admin.access")
const arr = (s?: string | null) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const t = await prisma.jobTemplate.findUnique({ where: { id: params.id }, include: { createdBy: { select: { id: true, name: true } } } })
  if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 })
  // Visible to the author, admins, or anyone if APPROVED (shared library).
  if (t.createdById !== ctx.userId && !ctx.has("admin.access") && t.status !== "APPROVED") {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }
  return NextResponse.json({ template: { ...t, requiredSkills: arr(t.requiredSkills), preferredSkills: arr(t.preferredSkills), requiredCompetencies: arr(t.requiredCompetencies), preferredCompetencies: arr(t.preferredCompetencies) } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const t = await prisma.jobTemplate.findUnique({ where: { id: params.id } })
  if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 })
  const isAdmin = ctx.has("admin.access")
  if (t.createdById !== ctx.userId && !isAdmin) return NextResponse.json({ error: "You can only manage your own templates." }, { status: 403 })

  const b = await req.json()
  const action = String(b.action || "")

  // Edit a draft (regenerate the JD from the updated skills/level unless text supplied).
  if (action === "edit") {
    if (t.status !== "DRAFT") return NextResponse.json({ error: "Only a draft template can be edited." }, { status: 409 })
    const requiredSkills = Array.isArray(b.requiredSkills) ? b.requiredSkills.map((s: any) => String(s).slice(0, 60)).slice(0, 40) : arr(t.requiredSkills)
    const level = b.level ? String(b.level).toUpperCase() : t.level
    const family = b.family !== undefined ? (b.family ? String(b.family).slice(0, 40) : null) : t.family
    const regenerate = b.regenerate === true
    const jd = regenerate ? generateJD({ title: b.title || t.title, family: family || undefined, level, skills: requiredSkills }) : null
    const updated = await prisma.jobTemplate.update({
      where: { id: t.id },
      data: {
        title: b.title != null ? String(b.title).slice(0, 200) : undefined,
        family, level, grade: b.grade != null ? String(b.grade).slice(0, 40) : undefined,
        requiredSkills: JSON.stringify(requiredSkills),
        preferredSkills: b.preferredSkills != null ? JSON.stringify(b.preferredSkills) : (jd ? JSON.stringify(jd.niceToHaves) : undefined),
        requiredCompetencies: JSON.stringify(competenciesFor(family || undefined, level)),
        summary: b.summary != null ? String(b.summary).slice(0, 2000) : (jd ? jd.summary : undefined),
        descriptionMd: b.descriptionMd != null ? String(b.descriptionMd).slice(0, 20000) : (jd ? jd.markdown : undefined),
      },
    })
    return NextResponse.json({ success: true, template: { ...updated } })
  }

  const check = canTransition(action as TemplateAction, t.status, { isApproverDistinct: t.createdById !== ctx.userId, isAdmin })
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 })

  if (action === "revise") {
    const uid = ctx.userId
    const fresh = await prisma.$transaction(async (tx) => {
      const created = await tx.jobTemplate.create({
        data: {
          createdById: uid, title: t.title, family: t.family, level: t.level, grade: t.grade,
          summary: t.summary, descriptionMd: t.descriptionMd, requiredSkills: t.requiredSkills,
          preferredSkills: t.preferredSkills, requiredCompetencies: t.requiredCompetencies,
          preferredCompetencies: t.preferredCompetencies, status: "DRAFT", version: t.version + 1,
        },
      })
      await tx.jobTemplate.update({ where: { id: t.id }, data: { status: "ARCHIVED", supersededById: created.id } })
      return created
    })
    return NextResponse.json({ success: true, template: fresh, revisedTo: fresh.id })
  }

  const data: any = { status: check.to }
  if (action === "approve") { data.approvedById = ctx.userId; data.approvedAt = new Date() }
  const updated = await prisma.jobTemplate.update({ where: { id: t.id }, data })
  return NextResponse.json({ success: true, template: updated })
}
