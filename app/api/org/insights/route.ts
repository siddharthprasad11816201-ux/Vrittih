import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { bucketByTemporal, headcount, temporalOf, subtreeIds, type UnitNode } from "@/lib/org/graph"
import { skillDemand, unitGaps, roleSupply, type PositionDemand, type SupplyPerson } from "@/lib/org/supply"
import { rateLimit } from "@/lib/ratelimit/store"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

/**
 * Workforce intelligence (§30, §57, §58). Every answer comes from real rows — positions,
 * employees, candidates and their VERIFIED skill assessments — never from a model's guess.
 *
 * Scoped to the caller's own company: an employer must never see another company's
 * headcount plan or candidate pool.
 *
 * Supported ?question=
 *   headcount        — current / upcoming / forecast, kept strictly apart
 *   skill-gaps       — which skills are short, org-wide
 *   department-gaps  — which departments have gaps
 *   role-supply      — which upcoming roles have insufficient candidate supply
 *   verified-skill   — who has VERIFIED evidence of a skill (&skill=PyTorch)
 */
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const rl = await rateLimit("read", payload.userId, { scope: "org-insights" })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

  const url = new URL(req.url)
  const question = url.searchParams.get("question") || "headcount"
  const unitId = url.searchParams.get("unitId")
  const now = new Date()
  const employerId = payload.userId

  const units: UnitNode[] = (await (prisma as any).orgUnit.findMany({
    where: { employerId, active: true }, select: { id: true, parentId: true, kind: true, name: true }, take: 1000,
  }))
  // A unit filter includes the whole subtree — "the platform department" means its teams too.
  const scopeIds = unitId ? subtreeIds(units, unitId) : null

  const positionRows = await (prisma as any).position.findMany({
    where: { employerId, ...(scopeIds ? { orgUnitId: { in: scopeIds } } : {}) },
    take: 2000,
  })
  const positions: PositionDemand[] = positionRows.map((p: any) => ({
    id: p.id, title: p.title, orgUnitId: p.orgUnitId, state: p.state,
    headcount: p.headcount, effectiveFrom: p.effectiveFrom, effectiveTo: p.effectiveTo,
    skills: safeArr(p.skills),
  }))

  if (question === "headcount") {
    const buckets = bucketByTemporal(positions, now)
    const summary = headcount(positions, now)
    return NextResponse.json({
      question, unitId: unitId ?? null, asOf: now.toISOString(),
      // The four states are returned SEPARATELY and never summed together.
      summary,
      note: "approved = filled + open + upcoming. forecast is modelled demand and is NOT approved headcount.",
      buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]: any) => [k, v.map((p: any) => ({ id: p.id, title: p.title, state: p.state, headcount: p.headcount }))])),
    })
  }

  // The remaining questions need the supply side.
  const people = await supplyPool(employerId)

  if (question === "skill-gaps") {
    return NextResponse.json({
      question, asOf: now.toISOString(),
      poolSize: people.length,
      skills: skillDemand(positions, people, now).slice(0, 100),
      note: "approvedDemand excludes filled seats and forecast-only roles; forecastDemand is reported separately.",
    })
  }

  if (question === "department-gaps") {
    const gaps = unitGaps(positions, people, now)
    const nameById = new Map(units.map((u) => [u.id, u.name]))
    return NextResponse.json({
      question, asOf: now.toISOString(),
      departments: gaps.map((g) => ({ ...g, name: nameById.get(g.orgUnitId) ?? "Unassigned" })),
    })
  }

  if (question === "role-supply") {
    // Only roles that are actually going to be hired for — history is irrelevant here.
    const future = positions.filter((p) => {
      const t = temporalOf(p, now)
      return (t === "UPCOMING" || t === "CURRENT") && p.state !== "FILLED"
    })
    const supply = roleSupply(future, people, now)
    return NextResponse.json({
      question, asOf: now.toISOString(),
      poolSize: people.length,
      roles: supply,
      insufficient: supply.filter((r) => !r.sufficient).map((r) => ({
        positionId: r.positionId, title: r.title, qualified: r.qualified,
        reason: r.requiredSkills.length === 0
          ? "No required skills recorded — supply cannot be assessed for this role."
          : `Only ${r.qualified} qualified people available.`,
      })),
    })
  }

  if (question === "verified-skill") {
    const skill = (url.searchParams.get("skill") || "").trim()
    if (!skill) return NextResponse.json({ error: "skill is required for this question." }, { status: 400 })
    // Verified means a real SkillAssessment row exists — not a self-reported profile skill.
    const rows = await (prisma as any).skillAssessment.findMany({
      where: { skill: { contains: skill } },
      orderBy: [{ proctored: "desc" }, { score: "desc" }],
      take: 100,
    })
    const userIds = [...new Set(rows.map((r: any) => r.userId))] as string[]
    const usersById = new Map((await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, headline: true } })).map((u) => [u.id, u]))
    return NextResponse.json({
      question, skill, asOf: now.toISOString(),
      people: rows.map((r: any) => ({
        userId: r.userId, name: usersById.get(r.userId)?.name ?? null, headline: usersById.get(r.userId)?.headline ?? null,
        skill: r.skill, score: r.score, proctored: r.proctored, takenAt: r.takenAt,
      })),
      note: "Only assessment-verified evidence is listed. Self-reported profile skills are excluded.",
    })
  }

  return NextResponse.json({ error: `Unknown question "${question}".`, supported: ["headcount", "skill-gaps", "department-gaps", "role-supply", "verified-skill"] }, { status: 400 })
}

function safeArr(v: any): string[] {
  try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a.map(String) : [] } catch { return [] }
}

/**
 * The supply pool: this employer's own employees plus candidates in the master, each with
 * their VERIFIED skill strengths. Unproctored evidence is discounted, matching the
 * ranking engine so the two never disagree.
 */
async function supplyPool(employerId: string): Promise<SupplyPerson[]> {
  const employees = await (prisma as any).employee.findMany({
    where: { employerId, status: { in: ["ACTIVE", "ONBOARDING"] } }, select: { id: true, userId: true }, take: 1000,
  })
  const candidates = await (prisma as any).candidate.findMany({
    where: { mergedIntoId: null }, select: { id: true, userId: true }, take: 2000,
  })

  const userIds = [...new Set([...employees.map((e: any) => e.userId), ...candidates.map((c: any) => c.userId).filter(Boolean)])] as string[]
  if (!userIds.length) return []

  const assessments = await (prisma as any).skillAssessment.findMany({ where: { userId: { in: userIds } }, take: 5000 })
  const byUser = new Map<string, Record<string, number>>()
  for (const a of assessments) {
    const m = byUser.get(a.userId) || {}
    const eff = Math.max(0, Math.min(1, a.score ?? 0)) * (a.proctored ? 1 : 0.6)
    const key = String(a.skill || "").toLowerCase()
    if (eff > (m[key] ?? 0)) m[key] = eff
    byUser.set(a.userId, m)
  }

  const out: SupplyPerson[] = []
  for (const e of employees) out.push({ id: e.id, kind: "employee", skills: byUser.get(e.userId) || {} })
  for (const c of candidates) if (c.userId) out.push({ id: c.id, kind: "candidate", skills: byUser.get(c.userId) || {} })
  return out
}
