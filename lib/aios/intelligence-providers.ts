/* EAIL — the deliberation core as an AIOS capability. Every AI product routes its
 * decisions through execute("intelligence.deliberate", { input: { brief } }) so the
 * reasoning is authorized, audited (AiRun) and observable — no module bypasses it. The
 * caller performs domain retrieval (context/knowledge/memory/competency/evidence) and
 * hands in a Brief; this runs the universal evidence-based, explainable, reflective
 * reasoning. In-house, no external LLM. */
import { registerProvider } from "./execute"
import { deliberate, type Brief } from "@/lib/intelligence/deliberate"

registerProvider("intelligence.deliberate", async (ctx) => {
  const raw = (ctx.input?.brief ?? ctx.input ?? {}) as Partial<Brief>
  const brief: Brief = {
    role: String(raw.role || "analyst").slice(0, 80),
    question: String(raw.question || "").slice(0, 500),
    context: Array.isArray(raw.context) ? raw.context.slice(0, 50) : undefined,
    memory: Array.isArray(raw.memory) ? raw.memory.slice(0, 50) : undefined,
    competency: Array.isArray(raw.competency) ? raw.competency.slice(0, 100) : undefined,
    evidence: Array.isArray(raw.evidence) ? raw.evidence.slice(0, 200) : undefined,
    criteria: Array.isArray(raw.criteria) ? raw.criteria.slice(0, 50) : undefined,
    options: Array.isArray(raw.options) ? raw.options.slice(0, 200) : undefined,
    weights: raw.weights && typeof raw.weights === "object" ? raw.weights : undefined,
    reasoningThreshold: typeof raw.reasoningThreshold === "number" ? raw.reasoningThreshold : undefined,
    evalThreshold: typeof raw.evalThreshold === "number" ? raw.evalThreshold : undefined,
  }
  const d = deliberate(brief)
  return { output: d, confidence: d.confidence, explanation: d.explanation, modelId: "enterprise-brain-v1" }
})

import { prisma } from "@/lib/prisma"
import { buildSuitabilityBrief, preScreenScore, skillOverlap, salaryRecommendation, interviewPlan, type CandidateProfile, type RequestSpec } from "@/lib/recruitment/fulfillment"

const safeArr = (s: string): string[] => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v.map(String) : [] } catch { return [] } }
const verdictRank = (v: string) => ({ supported: 3, uncertain: 2, "insufficient-evidence": 1, refuted: 0 } as Record<string, number>)[v] ?? 1
const yearsFromExperience = (exp: any[]) => { let m = 0; for (const e of exp || []) { const s = e.startDate ? +new Date(e.startDate) : NaN; const en = e.endDate ? +new Date(e.endDate) : Date.now(); if (Number.isFinite(s) && en >= s) m += (en - s) / (30.4 * 864e5) } return Math.round(m / 12) }
const SOFT = ["system design", "communication", "mentoring", "leadership", "problem solving"]
const extractSoft = (notes?: string | null) => { const n = String(notes || "").toLowerCase(); return SOFT.filter(s => n.includes(s) || n.includes(s.replace(" ", ""))) }

/* Recruiter Copilot — the Constitution's Employer Experience. Given a TalentRequest, search
 * the candidate pool, run EACH candidate through the Enterprise Brain (deliberate) for an
 * evidence-based suitability verdict, and return the best candidates with why/confidence/
 * risks/missing-competencies + a salary band + an interview plan. Persists the shortlist.
 * The API authorises that the caller owns/works the request before invoking this. */
registerProvider("recruit.shortlist", async (ctx) => {
  const requestId = String(ctx.input?.requestId || "")
  const req = await prisma.talentRequest.findUnique({ where: { id: requestId } })
  if (!req) return { output: { error: "request_not_found" }, explanation: "Requirement not found", confidence: 0, modelId: "enterprise-brain-v1" }
  const spec: RequestSpec = { title: req.title, roleType: req.roleType, skills: safeArr(req.skills), minYears: req.minYears, seniority: req.seniority, remote: req.remote, location: req.location, budget: req.budget, currency: req.currency, softSkills: extractSoft(req.notes) }

  const users = await prisma.user.findMany({ where: { role: "JOBSEEKER" }, include: { skills: { include: { skill: true } }, experience: true }, take: 800 })
  const ids = users.map(u => u.id)
  const comps = ids.length ? await prisma.userCompetency.findMany({ where: { userId: { in: ids } }, select: { userId: true, competencyKey: true, proficiency: true } }).catch(() => [] as any[]) : []
  const compBy = new Map<string, { key: string; proficiency: number }[]>()
  for (const c of comps as any[]) { const a = compBy.get(c.userId) || []; a.push({ key: c.competencyKey, proficiency: c.proficiency }); compBy.set(c.userId, a) }

  const profiles: CandidateProfile[] = users.map(u => ({
    id: u.id, name: u.name || u.email || "Candidate", headline: (u as any).headline || undefined,
    skills: (u.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
    years: yearsFromExperience((u as any).experience || []),
    competencies: compBy.get(u.id) || [], remoteOk: true,
  }))

  // Pre-screen cheaply, then deliberate on the most promising (bounded for performance).
  const screened = profiles.map(p => ({ p, pre: preScreenScore(p, spec) })).filter(x => x.pre > 0).sort((a, b) => b.pre - a.pre).slice(0, 20)
  const ranked = screened.map(({ p }) => {
    const d = deliberate(buildSuitabilityBrief(p, spec))
    const ov = skillOverlap(p.skills, spec.skills)
    return { candidateId: p.id, name: p.name, headline: p.headline, years: p.years, verdict: d.decision.verdict, confidence: d.confidence, why: d.explanation, matched: ov.matched, missing: ov.missing, coverage: ov.coverage, risks: d.risks, salary: salaryRecommendation(spec, p), interview: interviewPlan(spec, ov.missing) }
  }).sort((a, b) => (verdictRank(b.verdict) - verdictRank(a.verdict)) || b.confidence - a.confidence)

  // Persist the shortlist (top candidates as SOURCED, with the deliberation rationale).
  for (const c of ranked.slice(0, Math.max(req.headcount * 2, 10))) {
    await prisma.placementCandidate.upsert({
      where: { requestId_candidateId: { requestId, candidateId: c.candidateId } },
      update: { score: c.confidence, verdict: c.verdict, rationale: JSON.stringify({ why: c.why, missing: c.missing, risks: c.risks }) },
      create: { requestId, candidateId: c.candidateId, stage: "SOURCED", score: c.confidence, verdict: c.verdict, rationale: JSON.stringify({ why: c.why, missing: c.missing, risks: c.risks }), addedById: ctx.subjectId },
    }).catch(() => {})
  }
  const strong = ranked.filter(r => r.verdict === "supported").length
  const summary = `Screened ${profiles.length} candidate(s); deliberated ${ranked.length}; ${strong} strong fit(s) for ${req.headcount} ${req.title} opening(s).`
  return { output: { request: { id: req.id, title: req.title, headcount: req.headcount, skills: spec.skills }, candidates: ranked, screened: profiles.length, summary }, explanation: summary, confidence: ranked[0]?.confidence || 0, modelId: "enterprise-brain-v1" }
})

/* Managed placement — candidate side. For the calling candidate, rank OPEN employer
 * requirements by fit: build the same suitability Brief (candidate vs each requirement) and
 * route through the Enterprise Brain. Returns the best-matched openings with why/confidence/
 * missing-skills — the Constitution's "which companies match me", evidence-based. */
registerProvider("candidate.opportunities", async (ctx) => {
  const uid = ctx.subjectId as string
  const u = await prisma.user.findUnique({ where: { id: uid }, include: { skills: { include: { skill: true } }, experience: true } })
  if (!u) return { output: { candidate: null, opportunities: [], summary: "No profile found." }, explanation: "No candidate profile.", confidence: 0, modelId: "enterprise-brain-v1" }
  const comps = await prisma.userCompetency.findMany({ where: { userId: uid }, select: { competencyKey: true, proficiency: true } }).catch(() => [] as any[])
  const profile: CandidateProfile = {
    id: uid, name: u.name || u.email || "You", headline: (u as any).headline || undefined,
    skills: (u.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
    years: yearsFromExperience((u as any).experience || []),
    competencies: (comps as any[]).map(c => ({ key: c.competencyKey, proficiency: c.proficiency })), remoteOk: true,
  }
  const reqs = await prisma.talentRequest.findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: { createdAt: "desc" }, take: 100 })
  const ranked = reqs.map(r => {
    const spec: RequestSpec = { title: r.title, roleType: r.roleType, skills: safeArr(r.skills), minYears: r.minYears, seniority: r.seniority, remote: r.remote, location: r.location, budget: r.budget, currency: r.currency }
    const d = deliberate(buildSuitabilityBrief(profile, spec))
    const ov = skillOverlap(profile.skills, spec.skills)
    return { requestId: r.id, title: r.title, roleType: r.roleType, remote: r.remote, verdict: d.decision.verdict, confidence: d.confidence, matched: ov.matched, missing: ov.missing, coverage: ov.coverage, why: d.explanation }
  }).filter(x => x.verdict !== "refuted").sort((a, b) => (verdictRank(b.verdict) - verdictRank(a.verdict)) || b.confidence - a.confidence)
  const strong = ranked.filter(x => x.verdict === "supported").length
  const summary = ranked.length ? `${ranked.length} matching opening(s); ${strong} strong fit(s) for your profile.` : "No open requirements match your profile yet — add more skills/experience to improve matches."
  return { output: { candidate: { name: profile.name, skills: profile.skills, years: profile.years }, opportunities: ranked.slice(0, 25), summary }, explanation: summary, confidence: ranked[0]?.confidence || 0, modelId: "enterprise-brain-v1" }
})
