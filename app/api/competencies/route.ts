import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { DEFAULT_LIBRARY, COMPETENCY_KINDS, proficiencyBand, gapAnalysis } from "@/lib/learning/competency"

export const dynamic = "force-dynamic"
const canAuthor = (ctx: any) => ctx.has("admin.access")

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const [comps, mine] = await Promise.all([
    prisma.competency.findMany({ where: { published: true }, orderBy: [{ kind: "asc" }, { label: "asc" }], take: 500 }),
    prisma.userCompetency.findMany({ where: { userId: ctx.userId }, select: { competencyKey: true, proficiency: true, source: true } }),
  ])
  const myMap: Record<string, number> = {}
  for (const m of mine) myMap[m.competencyKey] = m.proficiency

  const library = comps.map(c => ({
    key: c.key, label: c.label, kind: c.kind, category: c.category,
    skills: (() => { try { return JSON.parse(c.skills || "[]") } catch { return [] } })(),
    myProficiency: myMap[c.key] ?? 0, band: proficiencyBand(myMap[c.key] ?? 0),
  }))

  // Optional target gap: ?target=<jobTemplateId> uses its required competencies at 0.6.
  let gap: any = null
  const target = new URL(req.url).searchParams.get("target")
  if (target) {
    const tpl = await prisma.jobTemplate.findUnique({ where: { id: target }, select: { title: true, requiredCompetencies: true } }).catch(() => null)
    if (tpl) {
      const reqs = (() => { try { return JSON.parse(tpl.requiredCompetencies || "[]") } catch { return [] } })()
      const targets = reqs.map((r: any) => ({ key: r.key, required: 0.6 }))
      gap = { title: tpl.title, ...gapAnalysis(targets, myMap) }
    }
  }

  return NextResponse.json({ library, kinds: COMPETENCY_KINDS, myCount: mine.length, canAuthor: canAuthor(ctx), gap, seeded: comps.length > 0 })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const action = String(b.action || "create")

  // Learner self-assessment — recorded honestly with source "self" (a weak signal).
  if (action === "self") {
    const key = String(b.competencyKey || "")
    const proficiency = Math.max(0, Math.min(1, Number(b.proficiency)))
    if (!key || !Number.isFinite(proficiency)) return NextResponse.json({ error: "competencyKey + proficiency required" }, { status: 400 })
    const exists = await prisma.competency.findUnique({ where: { key }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: "Unknown competency" }, { status: 404 })
    await prisma.userCompetency.upsert({
      where: { userId_competencyKey: { userId: ctx.userId, competencyKey: key } },
      create: { userId: ctx.userId, competencyKey: key, proficiency, source: "self", assessedAt: new Date() },
      update: { proficiency, source: "self", assessedAt: new Date() },
    })
    return NextResponse.json({ success: true })
  }

  if (!canAuthor(ctx)) return NextResponse.json({ error: "Authoring the competency framework requires admin access." }, { status: 403 })

  // Seed / refresh the default library (idempotent upsert by key).
  if (action === "seed") {
    let n = 0
    for (const c of DEFAULT_LIBRARY) {
      await prisma.competency.upsert({
        where: { key: c.key },
        create: { key: c.key, label: c.label, kind: c.kind, category: c.category || null, skills: JSON.stringify(c.skills || []), createdById: ctx.userId },
        update: { label: c.label, kind: c.kind, category: c.category || null, skills: JSON.stringify(c.skills || []) },
      }).then(() => n++).catch(() => {})
    }
    return NextResponse.json({ success: true, seeded: n })
  }

  // Author a new competency.
  const key = String(b.key || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const label = String(b.label || "").trim()
  if (!key || !label) return NextResponse.json({ error: "key + label required" }, { status: 400 })
  const kind = (COMPETENCY_KINDS as readonly string[]).includes(b.kind) ? b.kind : "technical"
  const c = await prisma.competency.create({
    data: { key, label: label.slice(0, 160), kind, description: b.description ? String(b.description).slice(0, 2000) : null, category: b.category || null, skills: JSON.stringify(Array.isArray(b.skills) ? b.skills.slice(0, 40) : []), parentId: b.parentId || null, createdById: ctx.userId },
  }).catch(() => null)
  if (!c) return NextResponse.json({ error: "That key already exists." }, { status: 409 })
  return NextResponse.json({ success: true, id: c.id }, { status: 201 })
}
