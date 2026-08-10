import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer } from "@/lib/career/engine"
import { rankJobs } from "@/lib/career/match"
import { inputFromUser } from "@/lib/career/fromUser"
import { getCalibration } from "@/lib/career/calibrationStore"
import { feedbackSignals } from "@/lib/career/calibration"

export const dynamic = "force-dynamic"

/* ICIRE — the Career Intelligence dashboard feed for the logged-in applicant:
 * their top skills, headline stats, and best-fit live roles (rankJobs). */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const analysis = analyzeCareer(await inputFromUser(p.userId))
  const skills = analysis.skills

  const jobs = await prisma.job.findMany({
    where: { active: true },
    select: { id: true, title: true, company: true, description: true, industry: true, createdAt: true, remote: true, skills: { include: { skill: true } } },
    orderBy: { createdAt: "desc" },
    take: 150,
  })
  // §21: outcome calibration — a CHEAP read of the cron/admin-precomputed global
  // cohort (MatchCalibration), never a live recompute on the request path. Null (a
  // neutral no-op) until enough decided outcomes exist; informational funnel +
  // feedback only (score weights stay off unless CAREER_CALIBRATE_WEIGHTS=on).
  const cal = await getCalibration("global").catch(() => null)
  const ranked = rankJobs(skills, jobs.map((j) => ({
    id: j.id, title: j.title, description: j.description, industry: j.industry, createdAt: j.createdAt, remote: j.remote,
    skills: (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
  })), cal)
  // Quality floor: only surface roles that are a genuine fit. Without this, a user with
  // few/no skills gets 6 rows at ~0% badged as "strong matches" — a self-contradicting,
  // broken-looking page. Sub-floor roles are dropped; the client shows an honest empty
  // state instead of listing 0% matches.
  const STRONG_FLOOR = 40
  const matches = ranked.filter((r) => r.match.overall >= STRONG_FLOOR).slice(0, 6).map((r) => {
    const job = jobs.find((j) => j.id === r.job.id)!
    return {
      id: r.job.id, title: job.title, company: job.company, remote: job.remote,
      overall: r.match.overall, projectedMatch: r.match.projectedMatch,
      matched: r.match.matched.slice(0, 4).map((m) => m.skill),
      missing: r.match.missing.slice(0, 3).map((m) => ({ skill: m.skill, difficulty: m.difficulty })),
      transferable: r.match.transferable.slice(0, 3).map((t) => ({ skill: t.skill, via: t.via })),
      label: r.match.hiring.label,
      advanceRate: r.match.hiring.calibrated ?? null, // empirically calibrated (null until enough real outcomes)
    }
  })

  return NextResponse.json({
    skills: skills.slice(0, 14).map((s) => ({ skill: s.skill, confidence: s.confidence, level: s.level, category: s.category, implied: s.implied })),
    stats: {
      total: skills.length,
      demonstrated: skills.filter((s) => !s.implied).length,
      strengths: analysis.summary?.topSkills?.slice(0, 5).map((t: any) => t.skill) || [],
      jobsConsidered: jobs.length,
    },
    matches,
    // §21 outcome learning — k-anonymized skill signals from real advancement, or null
    // until there's enough data to be trustworthy. Never identity/employer-specific.
    feedback: cal ? feedbackSignals(cal) : null,
  })
}
