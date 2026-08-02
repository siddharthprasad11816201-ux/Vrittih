/* ICIRE §11 + §13 — personalized learning roadmap & study planner. In-house.
 * Takes a match's missing skills (already prioritized, with difficulty, prep days
 * and expected match gain) + a timeframe, and produces a day-by-day plan with
 * curated resources, tasks, and projected-match milestones. Never rejects — guides. */
import { resourcesFor, type Resource } from "./resources"
import type { Category } from "./taxonomy"

type Missing = { skill: string; category: string; difficulty: string; prepDays: number; expectedGain: number; must: boolean }

export type RoadmapItem = { skill: string; category: string; difficulty: string; prepDays: number; expectedGain: number; resources: Resource[] }
export type StudyPhase = { order: number; skill: string; startDay: number; endDay: number; days: number; resources: Resource[]; tasks: string[]; milestoneMatch: number }
export type Roadmap = {
  timeframeDays: number
  startMatch: number
  projectedMatch: number
  items: RoadmapItem[]
  phases: StudyPhase[]
  coveredSkills: string[]
}

const TIMEFRAMES = [7, 14, 30, 60, 90]
export function normalizeTimeframe(d: number): number {
  return TIMEFRAMES.reduce((best, t) => (Math.abs(t - d) < Math.abs(best - d) ? t : best), 30)
}
function focusCount(days: number): number {
  return days <= 7 ? 2 : days <= 14 ? 3 : days <= 30 ? 4 : days <= 60 ? 5 : 6
}

export function buildRoadmap(match: { overall: number; projectedMatch: number; missing: Missing[] }, timeframeDaysRaw: number): Roadmap {
  const timeframeDays = normalizeTimeframe(timeframeDaysRaw)
  const n = Math.min(focusCount(timeframeDays), match.missing.length)
  const focus = match.missing.slice(0, n)

  const items: RoadmapItem[] = focus.map((m) => ({
    skill: m.skill, category: m.category, difficulty: m.difficulty, prepDays: m.prepDays, expectedGain: m.expectedGain,
    resources: resourcesFor(m.skill, m.category as Category),
  }))

  // Distribute the timeframe across focus skills proportional to their prep effort.
  const totalPrep = focus.reduce((s, m) => s + m.prepDays, 0) || 1
  let allocated = focus.map((m) => Math.max(2, Math.round((timeframeDays * m.prepDays) / totalPrep)))
  // Trim/pad so the plan fits the timeframe exactly.
  let diff = timeframeDays - allocated.reduce((s, d) => s + d, 0)
  for (let i = 0; diff !== 0 && i < allocated.length; i = (i + 1) % allocated.length) {
    if (diff > 0) { allocated[i]++; diff-- } else if (allocated[i] > 2) { allocated[i]--; diff++ }
    if (i === allocated.length - 1 && diff !== 0 && allocated.every((d) => d <= 2)) break
  }

  const phases: StudyPhase[] = []
  let day = 1, cumGain = 0
  focus.forEach((m, i) => {
    const days = allocated[i]
    cumGain += m.expectedGain
    const milestone = Math.min(match.projectedMatch, match.overall + cumGain)
    const rs = items[i].resources
    const primary = rs.find((r) => r.type === "docs" || r.type === "course" || r.type === "book") || rs[0]
    const practice = rs.find((r) => r.type === "practice")
    const project = rs.find((r) => r.type === "project")
    const tasks = [
      `Learn — ${primary.title}${primary.provider ? " (" + primary.provider + ")" : ""}`,
      practice ? `Practice — daily exercises on ${practice.provider}` : `Practice — work through exercises for ${m.skill}`,
      project ? `Build — ${project.title}` : `Build — a small project using ${m.skill}`,
      `Checkpoint — self-assess ${m.skill}, then add it to your résumé & profile`,
    ]
    phases.push({ order: i + 1, skill: m.skill, startDay: day, endDay: day + days - 1, days, resources: rs, tasks, milestoneMatch: milestone })
    day += days
  })

  return {
    timeframeDays, startMatch: match.overall, projectedMatch: match.projectedMatch,
    items, phases, coveredSkills: focus.map((m) => m.skill),
  }
}
