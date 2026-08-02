import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer } from "@/lib/career/engine"
import { matchJob } from "@/lib/career/match"
import { buildRoadmap } from "@/lib/career/roadmap"
import { inputFromUser } from "@/lib/career/fromUser"

export const dynamic = "force-dynamic"

/* ICIRE Phase 4 (§10–13) — a personalized learning roadmap + study plan for the
 * logged-in applicant to close the gap to this job. ?days=7|14|30|60|90. */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    select: { id: true, title: true, company: true, description: true, industry: true, skills: { include: { skill: true } } },
  })
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const days = parseInt(new URL(req.url).searchParams.get("days") || "30", 10) || 30
  const candidate = analyzeCareer(await inputFromUser(p.userId)).skills
  const match = matchJob(candidate, {
    title: job.title, description: job.description, industry: job.industry,
    skills: (job.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
  })
  const roadmap = buildRoadmap(match, days)

  return NextResponse.json({
    job: { id: job.id, title: job.title, company: job.company },
    overall: match.overall, projectedMatch: match.projectedMatch,
    roadmap,
  })
}
