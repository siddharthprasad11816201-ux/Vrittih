import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { computeMatch, candidateFromUser, jobFromRecord } from "@/lib/matching"

export const dynamic = "force-dynamic"

// Ranked best candidates for a job (employer view).
// ?pool=applicants (default) ranks people who applied; ?pool=all suggests any job seeker.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: { skills: { include: { skill: true } } },
    })
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    // Only the job's owner or an admin may view the candidate ranking.
    const isOwner = job.postedById === payload.userId
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(payload.role)
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const pool = new URL(req.url).searchParams.get("pool") || "applicants"
    const userInclude = {
      skills: { include: { skill: true } },
      experience: true,
      education: true,
    }

    let users: any[] = []
    let applicationByUser = new Map<string, any>()

    if (pool === "all") {
      users = await prisma.user.findMany({
        where: { role: "JOBSEEKER", banned: false },
        include: userInclude,
        take: 200,
      })
    } else {
      const apps = await prisma.application.findMany({
        where: { jobId: job.id },
        include: { user: { include: userInclude } },
      })
      users = apps.map((a) => a.user)
      applicationByUser = new Map(apps.map((a) => [a.userId, a]))
    }

    const mj = jobFromRecord(job)
    const ranked = users
      .map((u) => {
        const m = computeMatch(mj, candidateFromUser(u))
        const app = applicationByUser.get(u.id)
        return {
          userId: u.id,
          name: u.name,
          headline: u.headline,
          location: u.location,
          avatar: u.avatar,
          status: app?.status ?? null,
          appliedAt: app?.appliedAt ?? null,
          match: m,
        }
      })
      .sort((a, b) => b.match.score - a.match.score)

    return NextResponse.json({ job: { id: job.id, title: job.title, company: job.company }, pool, count: ranked.length, candidates: ranked })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
