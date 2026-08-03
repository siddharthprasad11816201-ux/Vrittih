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
