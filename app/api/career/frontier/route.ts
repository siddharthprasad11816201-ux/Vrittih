import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer } from "@/lib/career/engine"
import { computeFrontier } from "@/lib/career/frontier"
import { inputFromUser } from "@/lib/career/fromUser"

export const dynamic = "force-dynamic"

/* ICIRE — the market frontier for the logged-in applicant: the single skills that
 * would bring the most live roles within reach. From real active listings only. */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const candidate = analyzeCareer(await inputFromUser(p.userId)).skills
  const jobs = await prisma.job.findMany({
    where: { active: true },
    select: { title: true, description: true, industry: true, skills: { include: { skill: true } } },
    take: 250,
  })
  const frontier = computeFrontier(candidate, jobs.map((j) => ({
    title: j.title, description: j.description, industry: j.industry,
    skills: (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
  })))
  return NextResponse.json({ frontier })
}
