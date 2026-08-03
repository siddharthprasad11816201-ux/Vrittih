import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer } from "@/lib/career/engine"
import { matchJob } from "@/lib/career/match"
import { inputFromUser } from "@/lib/career/fromUser"
import { buildGroups, type GroupJobInput } from "@/lib/opportunity/groups"

export const dynamic = "force-dynamic"

/* ICAE — related opportunity groups for the logged-in candidate.
 * Discovers clusters of equivalent roles across employers (lib/opportunity), then
 * scores each posting with the ICIRE match engine (lib/career/match) and attaches
 * readiness + explainability. Read-only; no writes here. */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

function band(overall: number): string {
  return overall >= 75 ? "Ready" : overall >= 60 ? "Competitive" : overall >= 45 ? "Stretch" : "Aspirational"
}

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const url = new URL(req.url)
  const hideApplied = url.searchParams.get("hideApplied") !== "false"

  const analysis = analyzeCareer(await inputFromUser(p.userId))
  const skills = analysis.skills

  const [jobs, myApps, forms] = await Promise.all([
    prisma.job.findMany({
      where: { active: true },
      select: { id: true, title: true, company: true, description: true, industry: true, type: true, remote: true, createdAt: true, closesAt: true, skills: { include: { skill: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.application.findMany({ where: { userId: p.userId }, select: { jobId: true } }),
    prisma.applicationForm.findMany({ select: { jobId: true, requireResume: true, coverLetter: true, questions: true, documents: true, testId: true, testRequired: true } }),
  ])

  const appliedSet = new Set(myApps.map(a => a.jobId))
  const formByJob = new Map(forms.map(f => [f.jobId, f]))

  // Batch-apply eligibility: a job needs the full manual flow when its form requires
  // documents, screening answers, or an assessment (a generic batch can't satisfy these).
  const applyMode = (jobId: string): "profile" | "manual" => {
    const f = formByJob.get(jobId)
    if (!f) return "profile"
    const docs = (() => { try { return JSON.parse(f.documents || "[]") } catch { return [] } })()
    const qs = (() => { try { return JSON.parse(f.questions || "[]") } catch { return [] } })()
    if ((Array.isArray(docs) && docs.length) || (Array.isArray(qs) && qs.length) || (f.testRequired && f.testId)) return "manual"
    return "profile"
  }

  const groupInputs: GroupJobInput[] = jobs.map(j => ({
    id: j.id, title: j.title, company: j.company, description: j.description, type: j.type,
    skills: (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
  }))

  const groups = buildGroups(groupInputs, { minSize: 1 })
  const jobById = new Map(jobs.map(j => [j.id, j]))

  const out = groups.map(g => {
    const scored = g.jobs.map(gj => {
      const j = jobById.get(gj.id)!
      const m = matchJob(skills, {
        title: j.title, description: j.description, industry: j.industry,
        skills: (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
      })
      return {
        id: gj.id, title: gj.title, company: gj.company, remote: j.remote,
        roleLabel: gj.normalized.roleLabel, seniorityLabel: gj.normalized.seniorityLabel,
        closesAt: j.closesAt,
        overall: m.overall, technical: m.technical, confidence: m.confidence, band: band(m.overall),
        matched: m.matched.slice(0, 5).map(x => x.skill),
        missing: m.missing.slice(0, 4).map(x => ({ skill: x.skill, difficulty: x.difficulty, prepDays: x.prepDays })),
        why: (m.why || []).slice(0, 2),
        alreadyApplied: appliedSet.has(gj.id),
        applyMode: applyMode(gj.id),
      }
    })
    const visible = hideApplied ? scored.filter(s => !s.alreadyApplied) : scored
    visible.sort((a, b) => b.overall - a.overall)
    const overalls = scored.map(s => s.overall)
    const best = overalls.length ? Math.max(...overalls) : 0
    const avg = overalls.length ? Math.round(overalls.reduce((a, b) => a + b, 0) / overalls.length) : 0
    const readyCount = scored.filter(s => s.overall >= 75).length
    const eligibleCount = visible.filter(s => !s.alreadyApplied && s.applyMode === "profile").length

    const why = `${g.employers.length || g.size} ${g.employers.length === 1 ? "employer is" : "employers are"} hiring for ${g.clusterLabel} (${g.seniorityLabel}). ` +
      (best >= 60 ? `Your strongest fit here is ${best}%.` : `Your current fit tops out at ${best}% — see the gaps to close.`)

    return {
      key: g.key, cluster: g.cluster, clusterLabel: g.clusterLabel,
      seniority: g.seniority, seniorityLabel: g.seniorityLabel,
      roleLabels: g.roleLabels, employers: g.employers, size: g.size,
      sharedSkills: g.sharedSkills, cohesion: g.cohesion,
      readiness: { best, avg, ready: readyCount },
      eligibleCount, why,
      jobs: visible,
    }
  })
  // Only surface groups that still have visible opportunities; strongest fit first.
  const surfaced = out.filter(g => g.jobs.length > 0)
  surfaced.sort((a, b) => b.readiness.best - a.readiness.best || b.size - a.size)

  return NextResponse.json({
    groups: surfaced,
    stats: {
      groups: surfaced.length,
      opportunities: surfaced.reduce((n, g) => n + g.jobs.length, 0),
      employers: new Set(surfaced.flatMap(g => g.employers)).size,
      skills: skills.length,
    },
  })
}
