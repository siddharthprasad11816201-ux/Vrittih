import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

function scoreMatch(job: any, profile: any, skills: string[]): number {
  let score = 0
  const jobText = `${job.title} ${job.description} ${job.industry}`.toLowerCase()
  const jobSkills = job.skills?.map((s: any) => s.skill?.name?.toLowerCase()) || []

  // Skill overlap
  const userSkills = skills.map(s => s.toLowerCase())
  const matched = userSkills.filter(s => jobSkills.includes(s) || jobText.includes(s))
  score += (matched.length / Math.max(1, jobSkills.length)) * 40

  // Location match
  if (profile.location && job.location) {
    const pl = profile.location.toLowerCase()
    const jl = job.location.toLowerCase()
    if (pl === jl) score += 20
    else if (pl.split(",")[0] === jl.split(",")[0]) score += 10
    else if (job.remote) score += 15
  }

  // Role/title similarity
  const profileHeadline = (profile.headline || "").toLowerCase()
  const titleWords = job.title.toLowerCase().split(/\s+/)
  const headlineWords = profileHeadline.split(/\s+/)
  const titleMatch = titleWords.filter((w: string) => headlineWords.includes(w) && w.length > 3)
  score += Math.min(20, titleMatch.length * 7)

  // Industry match from experience
  const expTexts = profile.experience?.map((e: any) => e.description?.toLowerCase() || "").join(" ") || ""
  if (expTexts.includes(job.industry.toLowerCase())) score += 10

  // Recency bonus
  const daysSincePost = (Date.now() - new Date(job.createdAt).getTime()) / 86400000
  if (daysSincePost < 3) score += 10
  else if (daysSincePost < 7) score += 5

  return Math.min(100, Math.round(score))
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })

    const [user, jobs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          profile: true,
          skills: { include: { skill: true } },
          experience: { orderBy: { startDate: "desc" } },
          education: true,
        }
      }),
      prisma.job.findMany({
        where: { active: true },
        include: {
          skills: { include: { skill: true } },
          _count: { select: { applications: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    ])

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const userSkills = user.skills.map((s: any) => s.skill?.name || "")
    const profile = {
      headline: user.headline,
      location: user.location,
      experience: user.experience,
      education: user.education,
    }

    // Get already applied jobs
    const applied = await prisma.application.findMany({
      where: { userId: payload.userId },
      select: { jobId: true }
    })
    const appliedIds = new Set(applied.map((a: any) => a.jobId))

    const scored = jobs
      .filter(j => !appliedIds.has(j.id))
      .map(j => ({ ...j, matchScore: scoreMatch(j, profile, userSkills) }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 20)

    return NextResponse.json({ jobs: scored, userSkills })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}