import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"

const auth = (req: NextRequest) => {
  const t = req.cookies.get("er_token")?.value
  return t ? verifyToken(t) : null
}

// GET -> the user's saved jobs, newest first, with job details.
export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const saved = await prisma.savedJob.findMany({ where: { userId: p.userId }, orderBy: { createdAt: "desc" } })
  const jobs = await prisma.job.findMany({
    where: { id: { in: saved.map(s => s.jobId) } },
    include: { _count: { select: { applications: true } } },
  })
  const jMap = Object.fromEntries(jobs.map(j => [j.id, j]))
  return NextResponse.json({ jobs: saved.map(s => jMap[s.jobId]).filter(Boolean) })
}

// POST { jobId } -> toggle saved; returns { saved: boolean }.
export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { jobId } = await req.json()
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 })
  const existing = await prisma.savedJob.findUnique({ where: { userId_jobId: { userId: p.userId, jobId } } })
  if (existing) {
    await prisma.savedJob.delete({ where: { id: existing.id } })
    return NextResponse.json({ saved: false })
  }
  await prisma.savedJob.create({ data: { userId: p.userId, jobId } })
  return NextResponse.json({ saved: true })
}
