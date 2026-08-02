import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer } from "@/lib/career/engine"
import { rankJobs } from "@/lib/career/match"
import { inputFromUser } from "@/lib/career/fromUser"

export const dynamic = "force-dynamic"

/* ICIRE — the Career Intelligence dashboard feed for the logged-in applicant:
 * their top skills, headline stats, and best-fit live roles (rankJobs). */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const analysis = analyzeCareer(await inputFromUser(p.userId))
  const skills = analysis.skills

  const jobs = await prisma.job.findMany({
    where: { active: true },
    select: { id: true, title: true, company: true, description: true, industry: true, createdAt: true, remote: true, skills: { include: { skill: true } } },
    orderBy: { createdAt: "desc" },
    take: 150,
  })
  const ranked = rankJobs(skills, jobs.map((j) => ({
    id: j.id, title: j.title, description: j.description, industry: j.industry, createdAt: j.createdAt, remote: j.remote,
    skills: (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
  })))
  const matches = ranked.slice(0, 6).map((r) => {
    const job = jobs.find((j) => j.id === r.job.id)!
    return {
      id: r.job.id, title: job.title, company: job.company, remote: job.remote,
      overall: r.match.overall, projectedMatch: r.match.projectedMatch,
      matched: r.match.matched.slice(0, 4).map((m) => m.skill),
      missing: r.match.missing.slice(0, 3).map((m) => ({ skill: m.skill, difficulty: m.difficulty })),
      label: r.match.hiring.label,
    }
  })

  return NextResponse.json({
    skills: skills.slice(0, 14).map((s) => ({ skill: s.skill, confidence: s.confidence, level: s.level, category: s.category, implied: s.implied })),
    stats: {
      total: skills.length,
      demonstrated: skills.filter((s) => !s.implied).length,
      strengths: analysis.summary?.topSkills?.slice(0, 5).map((t: any) => t.skill) || [],
      jobsConsidered: jobs.length,
    },
    matches,
  })
}
