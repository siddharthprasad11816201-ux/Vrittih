import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { orgHeatmap, proficiencyBand } from "@/lib/learning/competency"

export const dynamic = "force-dynamic"
export const maxDuration = 60
const canOrg = (ctx: any) => ctx.has("ai.ops.view") || ctx.has("admin.access") || ctx.has("hrms.view")

/* ELTOS Module 13 — Learning Analytics. Personal learning stats always; org rollup
 * (completion, capability index) for executives/HR. Honest, evidence-based. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const [myEnroll, myCerts, myComps] = await Promise.all([
    prisma.enrollment.findMany({ where: { userId: ctx.userId }, select: { status: true, progressPct: true } }),
    prisma.certificate.count({ where: { userId: ctx.userId, kind: "course", revoked: false } }).catch(() => 0),
    prisma.userCompetency.findMany({ where: { userId: ctx.userId }, select: { proficiency: true } }),
  ])
  const me = {
    enrolled: myEnroll.length,
    completed: myEnroll.filter(e => e.status === "COMPLETED").length,
    inProgress: myEnroll.filter(e => e.status !== "COMPLETED" && e.progressPct > 0).length,
    certificates: myCerts,
    competencies: myComps.length,
    avgProficiency: myComps.length ? +(myComps.reduce((a, c) => a + c.proficiency, 0) / myComps.length).toFixed(2) : 0,
  }

  let org: any = null
  if (canOrg(ctx)) {
    // Platform operators (ai.ops.view / admin.access) see cross-tenant totals.
    // An hrms.view employer is NOT an operator — every Growth+ employer holds
    // hrms.view — so scope their rollup to their OWN workforce, or they'd read
    // platform-wide learning/competency intelligence across all tenants.
    const isOps = ctx.has("ai.ops.view") || ctx.has("admin.access")
    let scope: any = {}
    if (!isOps) {
      const emps = await prisma.employee.findMany({ where: { employerId: ctx.userId }, select: { userId: true } })
      scope = { userId: { in: emps.map(e => e.userId) } }
    }
    const [enrollAgg, completedAgg, coursesPub, certs30, compRows, comps, learners] = await Promise.all([
      prisma.enrollment.count({ where: scope }),
      prisma.enrollment.count({ where: { status: "COMPLETED", ...scope } }),
      prisma.course.count({ where: { status: "PUBLISHED" } }),
      prisma.certificate.count({ where: { kind: "course", issuedAt: { gte: new Date(Date.now() - 30 * 864e5) }, ...scope } }).catch(() => 0),
      prisma.userCompetency.findMany({ where: scope, select: { competencyKey: true, proficiency: true }, take: 50000 }),
      prisma.competency.findMany({ where: { published: true }, select: { key: true, label: true } }),
      prisma.userCompetency.findMany({ where: scope, distinct: ["userId"], select: { userId: true } }).then(r => r.length).catch(() => 0),
    ])
    const labelByKey = new Map(comps.map(c => [c.key, c.label]))
    const heat = orgHeatmap(compRows)
    const cells = heat.map(c => ({ ...c, label: labelByKey.get(c.key) || c.key }))
    org = {
      enrollments: enrollAgg,
      completionRate: enrollAgg ? Math.round((completedAgg / enrollAgg) * 1000) / 10 : null,
      coursesPublished: coursesPub,
      certificates30d: certs30,
      learners,
      capabilityIndex: cells.length ? Math.round((cells.reduce((a, c) => a + c.avg, 0) / cells.length) * 100) : null,
      capabilityBand: cells.length ? proficiencyBand(cells.reduce((a, c) => a + c.avg, 0) / cells.length) : null,
      weakest: cells.slice(0, 5),
      strongest: [...cells].reverse().slice(0, 5),
    }
  }
  return NextResponse.json({ me, org, canOrg: canOrg(ctx) })
}
