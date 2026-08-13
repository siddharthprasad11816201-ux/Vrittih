import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { computeMatch, candidateFromUser, jobFromRecord } from "@/lib/matching"
import { ci } from "@/lib/db"
import { safeExternalUrl } from "@/lib/url"
import { emit as emitEvent } from "@/lib/aios"   // AIOS event bus — drives Phase 13 automation
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
  closesAt: z.coerce.date().optional(),       // application deadline (was silently dropped)
  govBody: z.string().max(160).optional(),    // recruiting authority, for public-sector roles
  // Core posting fields the employer enters — previously stripped by this schema so
  // they never persisted or reached candidates. Now stored + rendered on job detail.
  requirements: z.string().max(5000).nullable().optional(),
  benefits: z.string().max(3000).nullable().optional(),
  experienceLevel: z.string().max(60).nullable().optional(),
  openings: z.number().int().min(1).max(9999).optional(),
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
    // Archived postings are hidden from everyone by default. An ADMIN may opt into seeing
    // them so they can review or restore — the privilege is checked server-side below, not
    // taken from the query string.
    const wantsArchived = searchParams.get("includeArchived") === "true"
    if (q) where.OR = [
      { title: ci(q) },
      { company: ci(q) },
      { description: ci(q) },
    ]
    if (industry) where.industry = industry
    // `type` accepts a single value or a comma list (e.g. Earn = FULLTIME,CONTRACT,…).
    if (type) where.type = type.includes(",") ? { in: type.split(",").map((t) => t.trim()).filter(Boolean) } : type
    if (remote === "true") where.remote = true

    // Never show a listing whose deadline has passed — the core complaint about
    // public portals is finding a notice and only then learning it closed.
    // (AND, so it composes with the `q` OR above.)
    const now = new Date()
    where.AND = [{ OR: [{ closesAt: null }, { closesAt: { gte: now } }] }]
    if (searchParams.get("closing") === "soon") {
      const in7 = new Date(now.getTime() + 7 * 86400000)
      where.AND.push({ closesAt: { gte: now, lte: in7 } })
    }
    if (searchParams.get("gov") === "true") where.AND.push({ govBody: { not: null } })

    // Resolve the viewer up front: both "mine" and the admin archived view depend on it.
    const viewerToken = req.cookies.get("er_token")?.value
    const viewer = viewerToken ? verifyToken(viewerToken) : null
    // Privilege comes from the DATABASE, not the token claim, so a demoted or banned admin
    // cannot keep seeing archived postings on a still-valid 7-day session.
    let viewerIsAdmin = false
    let viewerRole: string | null = null
    if (viewer && ["ADMIN", "SUPER_ADMIN"].includes(viewer.role)) {
      const row = await prisma.user.findUnique({ where: { id: viewer.userId }, select: { role: true, banned: true } })
      if (row && !row.banned && ["ADMIN", "SUPER_ADMIN"].includes(row.role)) {
        viewerIsAdmin = true
        viewerRole = row.role      // the CURRENT role, not the one baked into the token
      }
    }

    // "mine=true" — an employer's own postings (active or not)
    if (mine) {
      if (!viewer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      where.postedById = viewer.userId
      delete where.active
    } else if (wantsArchived && viewerIsAdmin) {
      // Admin review view: show archived alongside live. A non-admin asking for this is
      // simply ignored rather than errored, so the flag can never leak hidden postings.
      delete where.active
    }

    const include = {
      postedBy: { select: { id: true, name: true } },
      skills: { include: { skill: true } },
      _count: { select: { applications: true } },
    }

    // Plain browse (no search term, not an employer's own list) is diversified by
    // company. Ordering purely by newest let a single bulk import bury every other
    // employer — one company posting 1,400 roles meant page after page of only
    // them, and the rest of the board was effectively invisible. Round-robin takes
    // each company's newest, then each company's next, and so on: recency still
    // decides order *within* a company, but no employer can crowd out the others.
    const browsing = !q && !mine
    let jobs: any[], total: number

    if (browsing) {
      const [rows, count] = await Promise.all([
        prisma.job.findMany({ where, orderBy: { createdAt: "desc" }, select: { id: true, company: true }, take: 5000 }),
        prisma.job.count({ where }),
      ])
      const byCompany = new Map<string, string[]>()
      for (const r of rows) {
        const list = byCompany.get(r.company) || []
        list.push(r.id)
        byCompany.set(r.company, list)
      }
      const lists = [...byCompany.values()]
      const ordered: string[] = []
      for (let i = 0; ordered.length < rows.length; i++) {
        for (const l of lists) if (i < l.length) ordered.push(l[i])
      }
      const pageIds = ordered.slice(skip, skip + limit)
      const found = pageIds.length
        ? await prisma.job.findMany({ where: { id: { in: pageIds } }, include })
        : []
      const pos = new Map(pageIds.map((id, i) => [id, i]))
      jobs = found.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
      total = count
    } else {
      ;[jobs, total] = await Promise.all([
        prisma.job.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include }),
        prisma.job.count({ where }),
      ])
    }

    // If the viewer is a signed-in job seeker, attach a personalised match score.
    let jobsOut: any[] = jobs
    const payload = viewer
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
        // Verified skills (relation-less SkillAssessment) so the seeker's own match scores
        // reflect any assessments they've passed — same EduRankAI boost, candidate side.
        ;(user as any).skillAssessments = await (prisma as any).skillAssessment.findMany({ where: { userId: user.id } })
        const cand = candidateFromUser(user)
        jobsOut = jobs
          .map((j) => {
            const m = computeMatch(jobFromRecord(j), cand)
            return { ...j, match: { score: m.score, label: m.label, matchedSkills: m.matchedSkills, reasons: m.reasons.slice(0, 3) } }
          })
          .sort((a, b) => b.match.score - a.match.score)
      }
    }

    return NextResponse.json({
      jobs: jobsOut,
      total, page, pages: Math.ceil(total / limit),
      // Server-decided. The client renders admin controls from THIS, never from its own
      // idea of the user's role, so the UI cannot show actions the API would refuse.
      viewer: { isAdmin: viewerIsAdmin, canDelete: viewerRole === "SUPER_ADMIN" },
      includedArchived: wantsArchived && viewerIsAdmin,
    })
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
    // AIOS event → Phase 13 automation rules (fire-and-forget).
    emitEvent("job.created", { jobId: job.id, title: job.title, industry: job.industry, type: job.type, remote: job.remote }, { actorId: payload.userId }).catch(() => {})
    return NextResponse.json({ success: true, job }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
