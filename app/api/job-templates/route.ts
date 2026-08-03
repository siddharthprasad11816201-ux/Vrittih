import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { generateJD, competenciesFor } from "@/lib/jobarch/jd"

export const dynamic = "force-dynamic"

const canManage = (ctx: any) => ctx.has("jobs.post") || ctx.has("admin.access")
const arr = (s?: string | null) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }

function shape(t: any) {
  return {
    id: t.id, title: t.title, family: t.family, level: t.level, grade: t.grade, status: t.status,
    version: t.version, summary: t.summary, descriptionMd: t.descriptionMd,
    requiredSkills: arr(t.requiredSkills), preferredSkills: arr(t.preferredSkills),
    requiredCompetencies: arr(t.requiredCompetencies), preferredCompetencies: arr(t.preferredCompetencies),
    approvedAt: t.approvedAt, createdAt: t.createdAt, createdById: t.createdById,
    createdBy: t.createdBy ? { id: t.createdBy.id, name: t.createdBy.name } : null,
  }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const inc = { createdBy: { select: { id: true, name: true } } }
  // My templates + the shared APPROVED library (approved templates are reusable org-wide).
  const [mine, library] = await Promise.all([
    prisma.jobTemplate.findMany({ where: ctx.has("admin.access") ? {} : { createdById: ctx.userId }, include: inc, orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.jobTemplate.findMany({ where: { status: "APPROVED" }, include: inc, orderBy: { updatedAt: "desc" }, take: 200 }),
  ])
  const seen = new Set(mine.map(m => m.id))
  return NextResponse.json({
    mine: mine.map(shape),
    library: library.filter(l => !seen.has(l.id)).map(shape),
    isAdmin: ctx.has("admin.access"),
  })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const b = await req.json()
  const title = String(b.title || "").trim()
  if (!title) return NextResponse.json({ error: "A role title is required." }, { status: 400 })

  const requiredSkills: string[] = Array.isArray(b.requiredSkills) ? b.requiredSkills.map((s: any) => String(s).slice(0, 60)).slice(0, 40) : []
  const level = String(b.level || "MID").toUpperCase()
  const family = b.family ? String(b.family).slice(0, 40) : null
  // Generate the JD in-house unless the client supplied one.
  const jd = generateJD({ title, family: family || undefined, level, skills: requiredSkills, companyName: b.companyName, remote: !!b.remote })
  const reqComps = competenciesFor(family || undefined, level)

  const t = await prisma.jobTemplate.create({
    data: {
      createdById: ctx.userId, title: title.slice(0, 200), family, level,
      grade: b.grade ? String(b.grade).slice(0, 40) : null,
      summary: (b.summary ? String(b.summary) : jd.summary).slice(0, 2000),
      descriptionMd: (b.descriptionMd ? String(b.descriptionMd) : jd.markdown).slice(0, 20000),
      requiredSkills: JSON.stringify(requiredSkills),
      preferredSkills: JSON.stringify(Array.isArray(b.preferredSkills) ? b.preferredSkills.map((s: any) => String(s).slice(0, 60)).slice(0, 40) : jd.niceToHaves),
      requiredCompetencies: JSON.stringify(reqComps),
      preferredCompetencies: JSON.stringify(Array.isArray(b.preferredCompetencies) ? b.preferredCompetencies : []),
      status: "DRAFT", version: 1,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ success: true, template: shape(t) }, { status: 201 })
}
