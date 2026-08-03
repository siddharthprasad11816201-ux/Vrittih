/* Talent CRM — semantic talent discovery. PURE, testable.
 *
 * EROS Module 4. Ranks candidates against a target skill/role profile using the
 * canonicalized skill graph (aliases folded) — deterministic, explainable, no
 * embeddings/LLM. Coverage-weighted (how much of what you need does this person have)
 * with a small bonus for breadth, so a strong partial match ranks above a shallow one.
 */
import { canonical } from "@/lib/career/taxonomy"

function norm(s?: string[]): string[] {
  const out = new Set<string>()
  for (const x of s || []) { const c = canonical(x) || x; if (c) out.add(c.toLowerCase()) }
  return Array.from(out)
}

export interface TalentMatch {
  score: number        // 0..100
  coverage: number     // 0..1 — share of the QUERY skills the candidate has
  shared: string[]
  missing: string[]    // query skills the candidate lacks
  extra: string[]      // candidate skills beyond the query
}

/* Match a candidate's skills against the skills a role/search needs. Coverage is the
 * primary signal (do they have what we need); a small breadth term rewards depth. */
export function talentMatch(querySkills: string[], candidateSkills: string[]): TalentMatch {
  const q = norm(querySkills), c = norm(candidateSkills)
  const cset = new Set(c), qset = new Set(q)
  const shared = q.filter(x => cset.has(x))
  const missing = q.filter(x => !cset.has(x))
  const extra = c.filter(x => !qset.has(x))
  const coverage = q.length ? shared.length / q.length : 0
  // 85% coverage of what's needed + up to 15% for breadth beyond the ask — but breadth
  // only counts when there's ACTUAL coverage (no relevant skills ⇒ score 0, not a
  // spurious bonus for unrelated skills).
  const breadth = (q.length && shared.length) ? Math.min(1, extra.length / Math.max(3, q.length)) : 0
  const score = Math.round(Math.max(0, Math.min(100, (coverage * 0.85 + breadth * 0.15) * 100)))
  return { score, coverage: +coverage.toFixed(2), shared, missing, extra }
}

export interface RankedCandidate<T> { candidate: T; match: TalentMatch }

/* Rank candidates by match to the query skills; strongest first. */
export function rankTalent<T extends { skills?: string[] }>(querySkills: string[], candidates: T[]): RankedCandidate<T>[] {
  return candidates
    .map(cand => ({ candidate: cand, match: talentMatch(querySkills, cand.skills || []) }))
    .sort((a, b) => b.match.score - a.match.score || b.match.shared.length - a.match.shared.length)
}
