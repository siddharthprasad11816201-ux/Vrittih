/* ICIRE — market frontier (§19 companion): across ALL live roles, which single
 * skill would bring the most roles within reach? Complements the single-job
 * roadmap and the role-ladder simulator. In-house, honest: computed only from
 * real active listings and the candidate's real gaps — no invented demand. */
import { matchJob, type JobLike } from "./match"
import type { SkillResult } from "./engine"

export type FrontierSkill = { skill: string; difficulty: string; prepDays: number; jobsUnlocked: number; nearMissJobs: number; avgCurrentMatch: number; sampleTitles: string[] }
export type Frontier = { learnNext: FrontierSkill[]; jobsConsidered: number; note: string }

export function computeFrontier(candidate: SkillResult[], jobs: (JobLike & { title?: string })[]): Frontier {
  const tally = new Map<string, { unlock: number; near: number; matchSum: number; titles: string[]; difficulty: string; prepDays: number }>()
  let considered = 0
  for (const job of jobs) {
    const m = matchJob(candidate, job)
    considered++
    if (m.overall >= 78) continue // already a strong fit — nothing to unlock here
    for (const miss of m.missing) {
      const rec = tally.get(miss.skill) || { unlock: 0, near: 0, matchSum: 0, titles: [], difficulty: miss.difficulty, prepDays: miss.prepDays }
      rec.near++
      rec.matchSum += m.overall
      // "Unlocks" = closing THIS one skill (to ~0.7) would bring the role within reach.
      if (m.overall + miss.expectedGain >= 65) rec.unlock++
      if (rec.titles.length < 3 && job.title && !rec.titles.includes(job.title)) rec.titles.push(job.title)
      tally.set(miss.skill, rec)
    }
  }
  const learnNext = [...tally.entries()]
    .map(([skill, r]) => ({ skill, difficulty: r.difficulty, prepDays: r.prepDays, jobsUnlocked: r.unlock, nearMissJobs: r.near, avgCurrentMatch: Math.round(r.matchSum / r.near), sampleTitles: r.titles }))
    .filter((x) => x.nearMissJobs >= 2) // ignore one-off noise
    .sort((a, b) => b.jobsUnlocked - a.jobsUnlocked || b.nearMissJobs - a.nearMissJobs || a.prepDays - b.prepDays)
    .slice(0, 8)
  return { learnNext, jobsConsidered: considered, note: "Ranked by how many live roles each skill would bring within reach — from real active listings only." }
}
