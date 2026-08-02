import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer } from "@/lib/career/engine"
import { matchJob } from "@/lib/career/match"
import { buildRoadmap } from "@/lib/career/roadmap"
import { inputFromUser } from "@/lib/career/fromUser"

export const dynamic = "force-dynamic"

/* ICIRE §20 — start and track a learning plan for one job. Task ticks are
 * self-reported (stored in `phases`); "skill closed" and match progress are
 * RECOMPUTED from real analysis, never inferred from the ticks. Every read/write
 * keys on (token userId, jobId) — a client can never touch another user's plan. */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

async function liveMatch(userId: string, jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, title: true, description: true, industry: true, skills: { include: { skill: true } } },
  })
  if (!job) return null
  const candidate = analyzeCareer(await inputFromUser(userId)).skills
  const jobLike = { title: job.title, description: job.description, industry: job.industry, skills: (job.skills || []).map((s: any) => s.skill?.name).filter(Boolean) }
  return { match: matchJob(candidate, jobLike), candidate }
}

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const lm = await liveMatch(p.userId, params.jobId)
  if (!lm) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const row = await prisma.roadmapProgress.findUnique({ where: { userId_jobId: { userId: p.userId, jobId: params.jobId } } })
  if (!row) return NextResponse.json({ started: false, liveMatch: lm.match.overall })

  const phases = safe(row.phases) as { skill: string; tasksDone: boolean[] }[]
  const closed = phases.filter((ph) => (lm.candidate.find((s) => s.skill === ph.skill)?.confidence ?? 0) >= 0.5).map((ph) => ph.skill)
  return NextResponse.json({
    started: true, timeframeDays: row.timeframeDays, startMatch: row.startMatch, targetMatch: row.targetMatch,
    liveMatch: lm.match.overall, matchDelta: lm.match.overall - row.startMatch,
    phases, closedSkills: closed, startedAt: row.startedAt,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { jobId: string } }) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const lm = await liveMatch(p.userId, params.jobId)
  if (!lm) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const key = { userId_jobId: { userId: p.userId, jobId: params.jobId } }

  // Start (or restart) a plan: freeze the honest baseline from the live match.
  if (body.action === "start" || body.timeframeDays) {
    const days = [7, 14, 30, 60, 90].includes(body.timeframeDays) ? body.timeframeDays : 30
    const roadmap = buildRoadmap(lm.match, days)
    const phases = roadmap.phases.map((ph: any) => ({ skill: ph.skill, tasksDone: ph.tasks.map(() => false) }))
    const data = { timeframeDays: days, startMatch: lm.match.overall, targetMatch: roadmap.projectedMatch, phases: JSON.stringify(phases) }
    const row = await prisma.roadmapProgress.upsert({ where: key, update: data, create: { userId: p.userId, jobId: params.jobId, ...data } })
    return NextResponse.json({ ok: true, started: true, timeframeDays: row.timeframeDays, startMatch: row.startMatch, targetMatch: row.targetMatch, liveMatch: lm.match.overall, phases: safe(row.phases) })
  }

  // Tick a task.
  if (typeof body.phaseIndex === "number" && typeof body.taskIndex === "number") {
    const row = await prisma.roadmapProgress.findUnique({ where: key })
    if (!row) return NextResponse.json({ error: "No plan started" }, { status: 400 })
    const phases = safe(row.phases) as { skill: string; tasksDone: boolean[] }[]
    const ph = phases[body.phaseIndex]
    if (!ph || body.taskIndex < 0 || body.taskIndex >= ph.tasksDone.length) return NextResponse.json({ error: "Invalid task" }, { status: 400 })
    ph.tasksDone[body.taskIndex] = !!body.done
    await prisma.roadmapProgress.update({ where: key, data: { phases: JSON.stringify(phases) } })
    return NextResponse.json({ ok: true, phases })
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
}

function safe(s: string) { try { return JSON.parse(s) } catch { return [] } }
