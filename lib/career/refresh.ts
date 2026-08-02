import { prisma } from "@/lib/prisma"
import { analyzeCareer, type CareerAnalysis } from "@/lib/career/engine"
import { inputFromUser } from "@/lib/career/fromUser"
import { toVector, contentHash } from "@/lib/career/progress"
import { computeCareerDNA } from "@/lib/career/dna"

/** The SINGLE writer of a user's Career Intelligence profile (§20). Recomputes
 * from all current evidence (profile + skills + experience + uploaded documents),
 * persists the proficiencies + graph/summary, and — gated on real content change
 * or 30 days — records an immutable CareerSnapshot for growth/decay tracking.
 * Every route that mutates career-relevant data calls this; no route re-implements
 * the persist block. */
const THIRTY_DAYS = 30 * 24 * 3600 * 1000

export async function refreshCareer(userId: string, trigger = "manual"): Promise<CareerAnalysis> {
  const input = await inputFromUser(userId)
  const analysis = analyzeCareer(input)

  await prisma.$transaction([
    prisma.skillProficiency.deleteMany({ where: { userId } }),
    prisma.skillProficiency.createMany({
      data: analysis.skills.map((s) => ({
        userId, skill: s.skill, category: s.category, confidence: s.confidence, level: s.level, implied: s.implied,
        scores: JSON.stringify(s.scores), evidence: JSON.stringify(s.evidence),
      })),
    }),
    prisma.careerProfile.upsert({
      where: { userId },
      update: { graph: JSON.stringify(analysis.graph), summary: JSON.stringify(analysis.summary), computedAt: new Date() },
      create: { userId, graph: JSON.stringify(analysis.graph), summary: JSON.stringify(analysis.summary) },
    }),
  ])

  // Snapshot gate: only when the authored content changed or it's been >= 30 days.
  try {
    const hash = contentHash(input)
    const last = await prisma.careerSnapshot.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } })
    const changed = !last || last.contentHash !== hash
    const stale = last ? Date.now() - new Date(last.createdAt).getTime() >= THIRTY_DAYS : false
    if (changed || stale) {
      const explicit = analysis.skills.filter((s) => !s.implied).length
      const avg = analysis.skills.length ? analysis.skills.reduce((n, s) => n + s.confidence, 0) / analysis.skills.length : 0
      // Compact DNA signature so archetype/seniority drift is visible over time (§20/§6).
      const experienceMonths = (input.experiences || []).reduce((n, e) => n + (e.months || 0), 0)
      const roleTitles = (input.experiences || []).map((e) => e.title).filter(Boolean)
      const dna = computeCareerDNA(analysis, { experienceMonths, roleTitles })
      const dnaSig = { archetype: dna.archetype.key, label: dna.archetype.label, signature: dna.signature, seniority: dna.dimensions.find((d) => d.key === "seniority")?.band || null }
      await prisma.careerSnapshot.create({
        data: {
          userId, contentHash: hash, trigger,
          skillCount: analysis.skills.length, explicitCount: explicit, impliedCount: analysis.skills.length - explicit,
          avgConfidence: avg, skillVector: JSON.stringify(toVector(analysis.skills)), dna: JSON.stringify(dnaSig),
        },
      })
    }
  } catch { /* snapshotting is best-effort; never block the profile refresh */ }

  return analysis
}
