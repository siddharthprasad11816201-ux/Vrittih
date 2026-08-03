/* Job Architecture — role similarity, comparison & semantic search. PURE, testable.
 *
 * EROS Module 3. Deterministic, explainable role relationships: how alike are two roles
 * (skill overlap + level proximity + family match), which skills they share vs differ,
 * and ranking templates against a target skill/level profile (semantic-ish search via
 * the canonicalized skill graph, no embeddings). Reuses lib/career/taxonomy.
 */
import { canonical } from "@/lib/career/taxonomy"

const LEVEL_ORDER = ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "EXECUTIVE"]
function levelIdx(l?: string) { const i = LEVEL_ORDER.indexOf((l || "MID").toUpperCase()); return i < 0 ? 2 : i }
function normSkills(s?: string[]): string[] {
  const out = new Set<string>()
  for (const x of s || []) { const c = canonical(x) || x; if (c) out.add(c.toLowerCase()) }
  return Array.from(out)
}

export interface RoleProfile { skills?: string[]; level?: string; family?: string }
export interface Similarity {
  score: number            // 0..100
  skillJaccard: number     // 0..1
  levelDistance: number    // 0..5 (band steps apart)
  sameFamily: boolean
  shared: string[]
  onlyA: string[]
  onlyB: string[]
}

/* Similarity of two roles. Weighted: skills 0.7, level proximity 0.2, family 0.1. */
export function roleSimilarity(a: RoleProfile, b: RoleProfile): Similarity {
  const sa = normSkills(a.skills), sb = normSkills(b.skills)
  const setA = new Set(sa), setB = new Set(sb)
  const shared = sa.filter(x => setB.has(x))
  const union = new Set([...sa, ...sb])
  const skillJaccard = union.size ? shared.length / union.size : 0
  const levelDistance = Math.abs(levelIdx(a.level) - levelIdx(b.level))
  const levelProx = 1 - Math.min(1, levelDistance / 5)
  const sameFamily = !!a.family && !!b.family && a.family.toLowerCase() === b.family.toLowerCase()
  const score = Math.round((skillJaccard * 0.7 + levelProx * 0.2 + (sameFamily ? 1 : 0) * 0.1) * 100)
  return {
    score, skillJaccard: +skillJaccard.toFixed(3), levelDistance, sameFamily,
    shared, onlyA: sa.filter(x => !setB.has(x)), onlyB: sb.filter(x => !setA.has(x)),
  }
}

/* Rank candidate roles against a target profile (semantic job search / role match). */
export function rankBySimilarity<T extends RoleProfile & { id: string }>(query: RoleProfile, candidates: T[]): (T & { similarity: Similarity })[] {
  return candidates
    .map(c => ({ ...c, similarity: roleSimilarity(query, c) }))
    .sort((x, y) => y.similarity.score - x.similarity.score)
}
