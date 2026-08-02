import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer } from "@/lib/career/engine"
import { matchJob } from "@/lib/career/match"
import { inputFromUser } from "@/lib/career/fromUser"

export const dynamic = "force-dynamic"

/* ICIRE Phase 3 — explainable match for the logged-in applicant vs one job.
 * Returns the compatibility score, matched/missing skills, why, per-missing
 * difficulty + prep, projected match, and the hiring-probability funnel. */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    select: { id: true, title: true, company: true, description: true, industry: true, skills: { include: { skill: true } } },
  })
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const candidate = analyzeCareer(await inputFromUser(p.userId)).skills
  const match = matchJob(candidate, {
    title: job.title, description: job.description, industry: job.industry,
    skills: (job.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
  })

  return NextResponse.json({ job: { id: job.id, title: job.title, company: job.company }, match })
}
