import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer } from "@/lib/career/engine"
import { computeCareerDNA } from "@/lib/career/dna"
import { simulateCareer } from "@/lib/career/simulator"
import { inputFromUser } from "@/lib/career/fromUser"

export const dynamic = "force-dynamic"

/* ICIRE §19 — career-path simulation for the logged-in applicant. Uses their DNA
 * (family + seniority) to pick the ladder, reuses matchJob for honest gaps, and
 * binds to real active listings for CHF salary (never estimated). */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const input = await inputFromUser(p.userId)
  const analysis = analyzeCareer(input)
  const experienceMonths = (input.experiences || []).reduce((n, e) => n + (e.months || 0), 0)
  const roleTitles = (input.experiences || []).map((e) => e.title).filter(Boolean)
  const dna = computeCareerDNA(analysis, { experienceMonths, roleTitles })
  const bucket = dna.categoryLean[0]?.bucket
  const band = dna.dimensions.find((d) => d.key === "seniority")?.band

  const jobs = await prisma.job.findMany({
    where: { active: true },
    select: { title: true, salary: true, industry: true, skills: { include: { skill: true } } },
    take: 400,
  })
  const simJobs = jobs.map((j) => ({ title: j.title, salary: j.salary, industry: j.industry, skills: (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean) }))

  const simulation = simulateCareer(analysis.skills, { bucket, band, jobs: simJobs })
  return NextResponse.json({ simulation, from: { archetype: dna.archetype.label, band } })
}
