import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { jobRequirements } from "@/lib/career/match"
import { reviewResume } from "@/lib/career/resume"
import { resumeFromUser } from "@/lib/career/fromUser"

export const dynamic = "force-dynamic"

/* ICIRE Phase 5 (§14) — in-house résumé / ATS critique for the logged-in
 * applicant against one role: weak bullets, missing quantification, missing
 * keywords the ATS screens for, and section gaps — each with a concrete fix. */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    select: { id: true, title: true, company: true, description: true, industry: true, skills: { include: { skill: true } } },
  })
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  // Target keywords = the skills this role actually screens for (tagged + named
  // in the JD), skipping merely-implied noise.
  const targets = jobRequirements({
    title: job.title, description: job.description, industry: job.industry,
    skills: (job.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
  }).filter((r) => r.weight >= 0.8).map((r) => r.skill)

  const resume = await resumeFromUser(p.userId)
  const review = reviewResume(resume, targets)

  return NextResponse.json({ job: { id: job.id, title: job.title, company: job.company }, review })
}
