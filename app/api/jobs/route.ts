import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { computeMatch, candidateFromUser, jobFromRecord } from "@/lib/matching"
import { ci } from "@/lib/db"
import { safeExternalUrl } from "@/lib/url"
import { z } from "zod"

const jobSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(20),
  company: z.string().min(2),
  industry: z.string(),
  location: z.string().min(2),
  type: z.string(),
  salary: z.string().optional(),
  remote: z.boolean().default(false),
  applyUrl: z.string().max(500).optional(),   // company / department careers page
  govUrl: z.string().max(500).optional(),     // official government portal listing
  skills: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""
    const industry = searchParams.get("industry") || ""
    const type = searchParams.get("type") || ""
    const remote = searchParams.get("remote")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = 20
    const skip = (page - 1) * limit

    const mine = searchParams.get("mine") === "true"
    const where: any = { active: true }
    if (q) where.OR = [
      { title: ci(q) },
      { company: ci(q) },
      { description: ci(q) },
    ]
    if (industry) where.industry = industry
    if (type) where.type = type
    if (remote === "true") where.remote = true

    // "mine=true" — an employer's own postings (active or not)
    if (mine) {
      const t = req.cookies.get("er_token")?.value
      const p = t ? verifyToken(t) : null
      if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      where.postedById = p.userId
      delete where.active
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          postedBy: { select: { id: true, name: true } },
          skills: { include: { skill: true } },
          _count: { select: { applications: true } },
        },
      }),
      prisma.job.count({ where }),
    ])

    // If the viewer is a signed-in job seeker, attach a personalised match score.
    let jobsOut: any[] = jobs
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          skills: { include: { skill: true } },
          experience: true,
          education: true,
        },
      })
      if (user) {
        const cand = candidateFromUser(user)
        jobsOut = jobs
          .map((j) => {
            const m = computeMatch(jobFromRecord(j), cand)
            return { ...j, match: { score: m.score, label: m.label, matchedSkills: m.matchedSkills, reasons: m.reasons.slice(0, 3) } }
          })
          .sort((a, b) => b.match.score - a.match.score)
      }
    }

    return NextResponse.json({ jobs: jobsOut, total, page, pages: Math.ceil(total / limit) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    if (payload.role !== "EMPLOYER")
      return NextResponse.json({ error: "Only employers can post jobs" }, { status: 403 })

    const body = await req.json()
    const parsed = jobSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 })

    const { skills, applyUrl, govUrl, ...jobData } = parsed.data

    const job = await prisma.job.create({
      data: {
        ...jobData,
        applyUrl: safeExternalUrl(applyUrl),
        govUrl: safeExternalUrl(govUrl),
        postedById: payload.userId,
        skills: skills?.length ? {
          create: await Promise.all(skills.map(async (name) => {
            const skill = await prisma.skill.upsert({
              where: { name },
              update: {},
              create: { name },
            })
            return { skillId: skill.id }
          }))
        } : undefined,
      },
      include: { skills: { include: { skill: true } } },
    })

    await prisma.$transaction(async (tx) => {
      await (tx as any).jobCommunity.create({
        data: {
          jobId: job.id,
          name: `${jobData.title} @ ${jobData.company}`,
          description: `Community for applicants and professionals interested in the ${jobData.title} role at ${jobData.company}`,
          members: { create: { userId: payload.userId, role: "HOST" } }
        }
      })
    })
    return NextResponse.json({ success: true, job }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
