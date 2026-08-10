import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer } from "@/lib/career/engine"
import { matchJob } from "@/lib/career/match"
import { inputFromUser } from "@/lib/career/fromUser"
import { getCalibration, familyOf } from "@/lib/career/calibrationStore"
import { feedbackSignals } from "@/lib/career/calibration"

export const dynamic = "force-dynamic"

/* ICIRE Phase 3 — explainable match for the logged-in applicant vs one job.
 * Returns the compatibility score, matched/missing skills, why, per-missing
 * difficulty + prep, projected match, and the hiring-probability funnel. */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const job = await prisma.job.findUnique({
      where: { id: params.jobId },
      select: { id: true, title: true, company: true, description: true, industry: true, skills: { include: { skill: true } } },
    })
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const candidate = analyzeCareer(await inputFromUser(p.userId)).skills
    const jobSkills = (job.skills || []).map((s: any) => s.skill?.name).filter(Boolean)
    const jobLike = { title: job.title, description: job.description, industry: job.industry, skills: jobSkills }

    // §21: load this cohort's calibration (falls back to global). Informational —
    // the funnel shows a real advancement rate; the score itself is unchanged
    // unless an owner has explicitly enabled weight calibration.
    const cal = (await getCalibration(familyOf(jobSkills))) || (await getCalibration("global"))
    const match = matchJob(candidate, jobLike, cal)
    const feedback = cal ? feedbackSignals(cal) : null

    return NextResponse.json({ job: { id: job.id, title: job.title, company: job.company }, match, feedback })
  } catch (e: any) {
    // A single engine hiccup must not become an opaque 500 that makes the panel vanish.
    console.error("[MATCH]", e?.message)
    return NextResponse.json({ error: "Could not compute your match right now.", temporary: true }, { status: 503 })
  }
}
