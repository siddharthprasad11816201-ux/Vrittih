/* AIOS built-in capability providers. These are THIN orchestration wrappers over
 * the existing shared career libs (no duplicated logic — DDR reuse) so real
 * capabilities run through the gateway with full audit today; feature routes
 * migrate to call execute() incrementally. */
import { prisma } from "@/lib/prisma"
import { registerProvider } from "./execute"
import { search } from "@/lib/knowledge/semindex"
import { analyzeCareer } from "@/lib/career/engine"
import { rankJobs } from "@/lib/career/match"
import { computeCareerDNA } from "@/lib/career/dna"
import { computeFrontier } from "@/lib/career/frontier"
import { inputFromUser } from "@/lib/career/fromUser"
import { recruitCopilot } from "@/lib/copilot/recruit"
import { pipelineHealth } from "@/lib/talent/pools"
import { tutorRespond } from "@/lib/learning/tutor"
import { allAliases } from "@/lib/career/taxonomy"

async function candidate(userId: string) {
  const input = await inputFromUser(userId)
  const analysis = analyzeCareer(input)
  const experienceMonths = (input.experiences || []).reduce((n, e) => n + (e.months || 0), 0)
  const roleTitles = (input.experiences || []).map((e) => e.title).filter(Boolean)
  return { analysis, input, experienceMonths, roleTitles }
}
async function activeJobLikes(take = 200) {
  const jobs = await prisma.job.findMany({ where: { active: true }, select: { id: true, title: true, company: true, description: true, industry: true, createdAt: true, remote: true, skills: { include: { skill: true } } }, orderBy: { createdAt: "desc" }, take })
  return jobs.map((j) => ({ id: j.id, title: j.title, company: j.company, description: j.description, industry: j.industry, createdAt: j.createdAt, remote: j.remote, skills: (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean) }))
}

registerProvider("semindex.search", async (ctx) => {
  const { query, index, refType, limit } = ctx.input || {}
  const results = await search(String(query || ""), { index, refType, limit })
  return { output: { results }, explanation: `Semantic search returned ${results.length} result(s)`, modelId: "tfidf-embed-v1" }
})

registerProvider("career.rank", async (ctx) => {
  const { analysis } = await candidate(ctx.subjectId as string)
  const ranked = rankJobs(analysis.skills, await activeJobLikes()).slice(0, 10)
  return {
    output: { matches: ranked.map((r) => ({ id: r.job.id, title: r.job.title, company: (r.job as any).company, overall: r.match.overall })) },
    confidence: (ranked[0]?.match.confidence ?? 0) / 100,
    explanation: `Ranked ${ranked.length} active roles by real fit`, modelId: "icire-rank-v1",
  }
})

registerProvider("career.dna", async (ctx) => {
  const { analysis, experienceMonths, roleTitles } = await candidate(ctx.subjectId as string)
  const dna = computeCareerDNA(analysis, { experienceMonths, roleTitles })
  return { output: { dna }, explanation: dna.computed ? `Career DNA: ${dna.archetype.label}` : "Not enough profile evidence yet", modelId: "career-dna-v1" }
})

registerProvider("career.frontier", async (ctx) => {
  const { analysis } = await candidate(ctx.subjectId as string)
  const frontier = computeFrontier(analysis.skills, await activeJobLikes(250))
  return { output: { frontier }, explanation: `Frontier over ${frontier.jobsConsidered} live roles`, modelId: "icire-rank-v1" }
})

/* Recruiter copilot — reads the recruiter's real operational state and returns
 * prioritised next-best-actions (lib/copilot/recruit). Runs through the gateway (audited)
 * like every capability. isAdmin is passed by the calling route via ctx.input. */
registerProvider("recruit.copilot", async (ctx) => {
  const uid = ctx.subjectId as string
  const isAdmin = !!ctx.input?.isAdmin
  const now = Date.now()
  const in3d = new Date(now + 3 * 864e5)

  const [myInterviews, myJobs] = await Promise.all([
    prisma.interview.findMany({ where: { hostId: uid }, select: { id: true, scheduledAt: true } }).catch(() => [] as any[]),
    prisma.job.findMany({ where: { postedById: uid, active: true }, select: { id: true } }).catch(() => [] as any[]),
  ])
  const interviewIds = myInterviews.map((i: any) => i.id)
  const jobIds = myJobs.map((j: any) => j.id)
  const pastInterviewIds = myInterviews.filter((i: any) => +new Date(i.scheduledAt) < now).map((i: any) => i.id)

  const [offersToSend, offersExpiringSoon, scorecardInterviews, proctorToReview, pools, templatesPending, appGroups, referralsToTriage] = await Promise.all([
    prisma.offer.count({ where: { createdById: uid, status: "APPROVED" } }).catch(() => 0),
    prisma.offer.count({ where: { createdById: uid, status: "SENT", respondedAt: null, expiresAt: { gte: new Date(now), lte: in3d } } }).catch(() => 0),
    pastInterviewIds.length ? prisma.interviewScorecard.findMany({ where: { interviewId: { in: pastInterviewIds } }, distinct: ["interviewId"], select: { interviewId: true } }).then(r => r.length).catch(() => 0) : Promise.resolve(0),
    interviewIds.length ? prisma.proctorSession.count({ where: { kind: "interview", refId: { in: interviewIds }, reviewStatus: "PENDING", riskScore: { gte: 30 } } }).catch(() => 0) : Promise.resolve(0),
    prisma.talentPool.findMany({ where: { ownerId: uid }, select: { members: { select: { stage: true, addedAt: true, lastActivityAt: true } } }, take: 200 }).catch(() => [] as any[]),
    isAdmin ? prisma.jobTemplate.count({ where: { status: "PENDING_APPROVAL", createdById: { not: uid } } }).catch(() => 0) : Promise.resolve(0),
    jobIds.length ? prisma.application.groupBy({ by: ["jobId"], where: { jobId: { in: jobIds } }, _count: { _all: true } }).catch(() => [] as any[]) : Promise.resolve([] as any[]),
    jobIds.length ? prisma.referral.count({ where: { jobId: { in: jobIds }, status: "SUBMITTED" } }).catch(() => 0) : Promise.resolve(0),
  ])

  const scorecardsPending = Math.max(0, pastInterviewIds.length - (scorecardInterviews as number))
  const stalePools = (pools as any[]).filter(p => { const h = pipelineHealth(p.members.map((m: any) => ({ stage: m.stage, addedAt: m.addedAt, lastActivityAt: m.lastActivityAt }))); return p.members.length > 0 && (h.band === "cooling" || h.band === "cold") }).length
  const withEnough = new Set((appGroups as any[]).filter(g => (g._count?._all || 0) >= 3).map(g => g.jobId))
  const rolesLowFlow = jobIds.filter(id => !withEnough.has(id)).length

  const result = recruitCopilot({
    offersToSend, offersExpiringSoon, scorecardsPending, proctorToReview,
    stalePools, templatesPending, rolesLowFlow, referralsToTriage,
  })
  return { output: result, explanation: result.summary, modelId: "recruit-copilot-v1" }
})

/* In-house AI Tutor — deterministic pedagogy via lib/learning/tutor. Focus skills come
 * from skills named in the question, else the learner's weakest competencies' skills.
 * Runs through the gateway (audited). */
registerProvider("learning.tutor", async (ctx) => {
  const q = String(ctx.input?.question || "")
  const uid = ctx.subjectId as string | undefined
  const ql = q.toLowerCase()
  // 1) skills explicitly named in the question (canonicalised).
  const named = new Set<string>()
  for (const { alias, canon } of allAliases()) { if (alias.length >= 3 && ql.includes(alias)) named.add(canon) }
  let focus = Array.from(named).slice(0, 4)
  // 2) else fall back to the learner's weakest competencies' skills.
  if (!focus.length && uid) {
    const weak = await prisma.userCompetency.findMany({ where: { userId: uid }, orderBy: { proficiency: "asc" }, take: 3, select: { competencyKey: true } }).catch(() => [] as any[])
    if (weak.length) {
      const comps = await prisma.competency.findMany({ where: { key: { in: weak.map((w: any) => w.competencyKey) } }, select: { skills: true, label: true } })
      const s = new Set<string>()
      for (const c of comps) { try { for (const x of JSON.parse(c.skills || "[]")) s.add(String(x)) } catch {} }
      focus = s.size ? Array.from(s).slice(0, 4) : comps.map(c => c.label)
    }
  }
  const days = Number(ctx.input?.days) || 14
  const res = tutorRespond(q, { focusSkills: focus, days })
  return { output: res, explanation: res.explanation, modelId: "tutor-v1" }
})

/* Research AI Assistant — in-house literature retrieval over the semantic index +
 * knowledge base (no external LLM). Resolves research hits to output titles. Audited. */
registerProvider("research.assistant", async (ctx) => {
  const q = String(ctx.input?.question || "")
  const [lit, knowledge] = await Promise.all([
    search(q, { refType: "research", limit: 8 }).catch(() => [] as any[]),
    search(q, { refType: "knowledge", limit: 5 }).catch(() => [] as any[]),
  ])
  const ids = (lit as any[]).map(r => r.refId)
  const outs = ids.length ? await prisma.researchOutput.findMany({ where: { id: { in: ids }, status: "PUBLISHED" }, select: { id: true, title: true, kind: true, venue: true, url: true } }).catch(() => [] as any[]) : []
  const byId = new Map((outs as any[]).map(o => [o.id, o]))
  const literature = (lit as any[]).map(r => ({ ...(byId.get(r.refId) || { id: r.refId, title: "(untitled)" }), score: Math.round((r.score || 0) * 100) })).filter(x => byId.has(x.id))
  return {
    output: { literature, knowledgeHits: (knowledge as any[]).length, note: "In-house semantic retrieval over the research + knowledge index; no external LLM. Ask me to find related work by topic." },
    explanation: `Found ${literature.length} related published output(s)`, modelId: "research-assistant-v1",
  }
})
