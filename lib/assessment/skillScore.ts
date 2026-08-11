/**
 * Assessment -> skill scoring (the EduRankAI core). PURE and deterministic.
 *
 * Turns a graded attempt into per-skill percentages, so a proctored test can produce
 * VERIFIED skills that feed ranking (lib/matching) and competency evidence
 * (lib/learning/competency). Only auto-scorable, skill-tagged questions count — manual-review
 * (correct === null) and untagged questions are ignored, never held against the candidate.
 */

export interface GradedAnswer {
  skill?: string | null   // canonical skill the question assesses (Question.skill)
  possible: number        // question points (the denominator contribution)
  earned: number          // points awarded (0..possible)
  graded: boolean         // false for manual-review / ungraded questions -> excluded
  difficulty?: number     // 1..5, for surfacing the hardest level covered
}

export interface SkillScore {
  skill: string
  score: number       // 0..1 fraction of points earned on this skill's questions
  earned: number
  possible: number
  count: number       // number of graded questions for this skill
  difficulty: number  // hardest difficulty covered (default 3)
}

/** Group graded answers by skill and compute each skill's earned/possible fraction. */
export function skillScores(answers: GradedAnswer[]): SkillScore[] {
  const agg = new Map<string, { earned: number; possible: number; count: number; difficulty: number }>()
  for (const a of answers) {
    if (!a.graded) continue
    const skill = (a.skill || "").trim()
    if (!skill) continue
    const possible = Math.max(0, a.possible || 0)
    if (possible <= 0) continue
    const earned = Math.max(0, Math.min(possible, a.earned || 0))
    const g = agg.get(skill) || { earned: 0, possible: 0, count: 0, difficulty: 1 }
    g.earned += earned
    g.possible += possible
    g.count += 1
    g.difficulty = Math.max(g.difficulty, Math.max(1, Math.min(5, a.difficulty || 3)))
    agg.set(skill, g)
  }
  const out: SkillScore[] = []
  for (const [skill, g] of agg) {
    out.push({
      skill,
      score: g.possible > 0 ? +(g.earned / g.possible).toFixed(4) : 0,
      earned: g.earned,
      possible: g.possible,
      count: g.count,
      difficulty: g.difficulty,
    })
  }
  // Strongest demonstrated skill first (stable, deterministic).
  out.sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill))
  return out
}
