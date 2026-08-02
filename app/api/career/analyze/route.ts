import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer, type AnalyzeInput } from "@/lib/career/engine"

export const dynamic = "force-dynamic"

/* ICIRE — (re)compute the applicant's Career Intelligence profile (§20 continuous
 * learning: call this after any new upload). In-house, no LLM.
 * POST body:
 *   {}            -> analyze the logged-in user's data and PERSIST the profile
 *   { input }     -> analyze the given AnalyzeInput and return it WITHOUT persisting
 *                    (self-analysis / preview) */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
const monthsBetween = (a: Date, b: Date) => Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
const yearsSince = (d: Date) => Math.max(0, (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25))

async function inputFromUser(userId: string): Promise<AnalyzeInput> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { education: true, experience: true, skills: { include: { skill: true } } },
  })
  const docs = await prisma.careerDocument.findMany({ where: { userId }, select: { kind: true, rawText: true }, take: 25 })
  return {
    name: user?.name,
    headline: user?.headline || undefined,
    bio: user?.bio || undefined,
    skills: (user?.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
    experiences: (user?.experience || []).map((e: any) => {
      const end = e.endDate ? new Date(e.endDate) : new Date()
      return { title: e.title, company: e.company, description: e.description || undefined, months: monthsBetween(new Date(e.startDate), end), ageYears: Math.round(yearsSince(end)) }
    }),
    education: (user?.education || []).map((e: any) => ({ school: e.school, degree: e.degree, field: e.field })),
    documents: docs.map((d) => ({ kind: (d.kind === "resume" ? "document" : "document") as any, text: d.rawText })),
  }
}

export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  // Preview / self-analysis mode — analyze provided text, do not persist.
  if (body.input && typeof body.input === "object") {
    return NextResponse.json({ ok: true, persisted: false, analysis: analyzeCareer(body.input as AnalyzeInput) })
  }

  const input = await inputFromUser(p.userId)
  const analysis = analyzeCareer(input)

  // Persist: replace this user's skill proficiencies + upsert the graph/summary.
  await prisma.$transaction([
    prisma.skillProficiency.deleteMany({ where: { userId: p.userId } }),
    prisma.skillProficiency.createMany({
      data: analysis.skills.map((s) => ({
        userId: p.userId, skill: s.skill, category: s.category, confidence: s.confidence, level: s.level, implied: s.implied,
        scores: JSON.stringify(s.scores), evidence: JSON.stringify(s.evidence),
      })),
    }),
    prisma.careerProfile.upsert({
      where: { userId: p.userId },
      update: { graph: JSON.stringify(analysis.graph), summary: JSON.stringify(analysis.summary), computedAt: new Date() },
      create: { userId: p.userId, graph: JSON.stringify(analysis.graph), summary: JSON.stringify(analysis.summary) },
    }),
  ])

  return NextResponse.json({ ok: true, persisted: true, analysis })
}
