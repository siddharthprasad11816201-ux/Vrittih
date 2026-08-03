/* Internship program helpers — pure. The default 8-week roadmap and completion
 * math. Milestone/PPO vocabularies are shared by the API + UI. */

export const DEFAULT_ROADMAP = [
  "Orientation & onboarding",
  "Foundations & training",
  "First mini-project",
  "Team project — contribute",
  "Mid-internship evaluation",
  "Ownership & leadership",
  "Innovation / capstone",
  "Final review & handover",
]

export const PPO_STATUSES = ["NONE", "CONSIDERING", "OFFERED", "ACCEPTED", "DECLINED"] as const
export const INTERNSHIP_STATUSES = ["ACTIVE", "COMPLETED", "DROPPED"] as const
export const MILESTONE_STATUSES = ["PENDING", "IN_PROGRESS", "DONE"] as const

/** Milestone titles for a program of `weeks` weeks (keeps the final review last). */
export function roadmapTitles(weeks: number): string[] {
  const base = DEFAULT_ROADMAP
  if (weeks === base.length) return [...base]
  if (weeks < base.length) return [...base.slice(0, Math.max(1, weeks - 1)), base[base.length - 1]].slice(0, weeks)
  const filler = Array.from({ length: weeks - base.length }, (_, i) => `Project work — week ${base.length + i}`)
  return [...base.slice(0, base.length - 1), ...filler, base[base.length - 1]]
}

export function seedMilestones(weeks: number, startedAt: Date): { week: number; title: string; dueAt: Date }[] {
  return roadmapTitles(weeks).map((title, i) => ({
    week: i + 1, title, dueAt: new Date(startedAt.getTime() + (i + 1) * 7 * 86400000),
  }))
}

export function completionPct(milestones: { status: string }[]): number {
  if (!milestones.length) return 0
  const done = milestones.filter((m) => m.status === "DONE").length
  return Math.round((done / milestones.length) * 100)
}

export const PPO_LABEL: Record<string, string> = {
  NONE: "Not yet assessed", CONSIDERING: "Under consideration", OFFERED: "PPO offered",
  ACCEPTED: "PPO accepted", DECLINED: "PPO declined",
}
