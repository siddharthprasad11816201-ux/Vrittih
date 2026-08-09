import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { rankTalent } from "@/lib/talent/discovery"
import { parseTalentQuery, type TalentQuery } from "@/lib/talent/query"
import { counterfactuals } from "@/lib/talent/counterfactual"

export const dynamic = "force-dynamic"
const canManage = (ctx: any) => ctx.has("candidates.view") || ctx.has("pipeline.manage") || ctx.has("jobs.post") || ctx.has("admin.access")

/* EROS Module 4 / spec §31,§40,§41 — semantic + natural-language talent discovery.
 * Accepts a plain-English brief ("Python engineers with real ML deployment experience,
 * preferably research") OR an explicit skills[]. Parses it to a structured spec
 * (must/preferred/seniority/requireEvidence), ranks job-seekers by skill-graph cover
 * (in-house, no embeddings/LLM), and — when the recruiter asked for real experience —
 * marks which matched skills are actually DEMONSTRATED in the candidate's experience.
 * Returns the interpretation so the search is explainable, never a black box. */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 403 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const b = await req.json()

  let query: TalentQuery | null = null
  let skills: string[] = Array.isArray(b.skills) ? b.skills.map((s: any) => String(s)).filter(Boolean).slice(0, 30) : []
  if (typeof b.q === "string" && b.q.trim()) { query = parseTalentQuery(b.q); skills = [...query.must, ...query.preferred] }
  if (!skills.length) return NextResponse.json({ error: query ? "No skills detected in that description — try naming skills (e.g. Python, React)." : "Provide at least one skill to search for.", interpretation: query?.interpretation }, { status: 400 })

  const users = await prisma.user.findMany({
    where: { role: "JOBSEEKER", ...(b.openToWork ? { openToWork: true } : {}) },
    select: { id: true, name: true, email: true, headline: true, openToWork: true, skills: { include: { skill: true } } },
    take: 400,
  })
  const candidates = users.map(u => ({
    id: u.id, name: u.name, headline: u.headline, openToWork: u.openToWork,
    skills: (u.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
  }))
  const ranked = rankTalent(skills, candidates).filter(r => r.match.score > 0).slice(0, 40)

  // Evidence pass: for the ranked candidates, find which matched skills are shown in
  // their real experience (spec §40). Bounded to the top results.
  const topIds = ranked.map(r => r.candidate.id)
  const exps = topIds.length
    ? await prisma.experience.findMany({ where: { userId: { in: topIds } }, select: { userId: true, title: true, company: true, description: true }, take: 3000 }).catch(() => [] as any[])
    : []
  const expByUser = new Map<string, string>()
  for (const e of exps) expByUser.set(e.userId, ((expByUser.get(e.userId) || "") + " " + [e.title, e.company, e.description].filter(Boolean).join(" ")).toLowerCase())

  let results = ranked.map(r => {
    const txt = expByUser.get(r.candidate.id) || ""
    const demonstrated = (r.match.shared || []).filter((s: string) => txt.includes(s.toLowerCase()))
    return {
      id: r.candidate.id, name: r.candidate.name, headline: r.candidate.headline, openToWork: r.candidate.openToWork,
      score: r.match.score, coverage: r.match.coverage, shared: r.match.shared, missing: r.match.missing, demonstrated,
      // §22 counterfactual: the additions that would most raise this candidate's fit.
      strengthen: counterfactuals(r.candidate.skills || [], skills, 3),
    }
  })
  // When the recruiter wants real experience, rank demonstrated coverage first.
  if (query?.requireEvidence) results = results.sort((a, b2) => (b2.demonstrated.length - a.demonstrated.length) || (b2.score - a.score))

  return NextResponse.json({ interpretation: query?.interpretation, requireEvidence: !!query?.requireEvidence, results })
}
