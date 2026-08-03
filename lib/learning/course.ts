/* Content Platform + Learning Path Engine — PURE, testable.
 *
 * ELTOS Modules 3 & 4. Courses/lessons are competency‑mapped learning experiences; this
 * module owns the deterministic progress math and the learning‑path assembly (rank
 * courses by how much of a target skill/competency gap they close). Reuses the shared
 * skill graph (lib/career/taxonomy) — no separate vocabulary.
 */
import { canonical } from "@/lib/career/taxonomy"

export const LESSON_TYPES = ["reading", "video", "exercise", "quiz", "project"] as const
export type LessonType = (typeof LESSON_TYPES)[number]

export function courseProgressPct(totalLessons: number, doneLessons: number): number {
  if (totalLessons <= 0) return 0
  if (doneLessons >= totalLessons) return 100
  // Never round an INCOMPLETE course up to 100 (199/200 must not read as done).
  return Math.max(0, Math.min(99, Math.floor((doneLessons / totalLessons) * 100)))
}

export interface LessonLike { id: string; order?: number }
/* First not-yet-completed lesson in order (null when the course is complete). */
export function nextLesson<T extends LessonLike>(lessons: T[], doneIds: Set<string> | string[]): T | null {
  const done = doneIds instanceof Set ? doneIds : new Set(doneIds)
  const ordered = [...lessons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return ordered.find(l => !done.has(l.id)) || null
}

export function estimatedMinutes(lessons: { durationMin?: number }[]): number {
  return lessons.reduce((n, l) => n + (Number(l.durationMin) || 0), 0)
}

function norm(s?: string[]): string[] {
  const out = new Set<string>()
  for (const x of s || []) { const c = canonical(x) || x; if (c) out.add(c.toLowerCase()) }
  return Array.from(out)
}

export interface CourseLike { id: string; title?: string; skills?: string[]; level?: string }
export interface CourseRecommendation<T> { course: T; covers: string[]; coverage: number; newSkillCount: number; breadth: number }

/* Rank courses by how much of a target skill set (a gap) they teach. Coverage = share of
 * target skills the course covers; ties broken by the course's overall breadth (total
 * taught skills). Only courses that cover at least one target skill are returned. */
export function coursesForGap<T extends CourseLike>(targetSkills: string[], courses: T[]): CourseRecommendation<T>[] {
  const target = norm(targetSkills)
  const tset = new Set(target)
  if (!target.length) return []
  return courses
    .map(c => {
      const cs = norm(c.skills)
      const covers = cs.filter(s => tset.has(s))
      return { course: c, covers, coverage: +(covers.length / target.length).toFixed(2), newSkillCount: covers.length, breadth: cs.length }
    })
    .filter(r => r.covers.length > 0)
    .sort((a, b) => b.coverage - a.coverage || b.breadth - a.breadth)
}

/* Assemble an ordered learning path over a target gap: greedily pick the course that
 * covers the most still-uncovered target skills, until the gap is covered or we run out.
 * Returns the sequence + which skills remain uncovered (honest about gaps). */
export interface PathStep<T> { order: number; course: T; newlyCovers: string[] }
export function assemblePath<T extends CourseLike>(targetSkills: string[], courses: T[], maxSteps = 8): { steps: PathStep<T>[]; uncovered: string[] } {
  const remaining = new Set(norm(targetSkills))
  const pool = courses.map(c => ({ c, skills: norm(c.skills) }))
  const steps: PathStep<T>[] = []
  const used = new Set<string>()
  while (remaining.size && steps.length < maxSteps) {
    let best: { c: T; gain: string[] } | null = null
    for (const p of pool) {
      if (used.has(p.c.id)) continue
      const gain = p.skills.filter(s => remaining.has(s))
      if (gain.length && (!best || gain.length > best.gain.length)) best = { c: p.c, gain }
    }
    if (!best) break
    used.add(best.c.id)
    for (const s of best.gain) remaining.delete(s)
    steps.push({ order: steps.length + 1, course: best.c, newlyCovers: best.gain })
  }
  return { steps, uncovered: Array.from(remaining) }
}
