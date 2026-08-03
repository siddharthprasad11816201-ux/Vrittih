import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { rankTalent } from "@/lib/talent/discovery"

export const dynamic = "force-dynamic"
const canManage = (ctx: any) => ctx.has("candidates.view") || ctx.has("pipeline.manage") || ctx.has("jobs.post") || ctx.has("admin.access")

/* EROS Module 4 — semantic talent discovery. Ranks job-seekers by how well their skills
 * cover a target skill set (in-house skill-graph match, no embeddings/LLM). */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 403 })
  if (!canManage(ctx)) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const b = await req.json()
  const skills: string[] = Array.isArray(b.skills) ? b.skills.map((s: any) => String(s)).filter(Boolean).slice(0, 30) : []
  if (!skills.length) return NextResponse.json({ error: "Provide at least one skill to search for." }, { status: 400 })

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
  return NextResponse.json({
    results: ranked.map(r => ({
      id: r.candidate.id, name: r.candidate.name, headline: r.candidate.headline, openToWork: r.candidate.openToWork,
      score: r.match.score, coverage: r.match.coverage, shared: r.match.shared, missing: r.match.missing,
    })),
  })
}
