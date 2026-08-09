/* Spec §22 — counterfactual matching: "what would make this candidate a stronger
 * match?" For each query skill the candidate lacks, compute the REAL marginal fit
 * lift (re-score with that skill added) and note when it's transferable from a skill
 * they already have (via the ontology implication graph, §20/§21). Evidence-based,
 * never fabricates achievements. Pure → unit-tested. */
import { talentMatch } from "./discovery"
import { canonical, IMPLY } from "@/lib/career/taxonomy"

export type Counterfactual = { skill: string; lift: number; transferableFrom?: string }

const canon = (s: string) => canonical(s) || s

export function counterfactuals(candidateSkills: string[], querySkills: string[], max = 4): Counterfactual[] {
  const base = talentMatch(querySkills, candidateSkills).score
  const have = new Set(candidateSkills.map((s) => canon(s).toLowerCase()))
  const out: Counterfactual[] = []
  const seen = new Set<string>()
  for (const qs of querySkills) {
    const name = canon(qs)
    const key = name.toLowerCase()
    if (have.has(key) || seen.has(key)) continue
    seen.add(key)
    const lift = talentMatch(querySkills, [...candidateSkills, name]).score - base
    if (lift <= 0) continue
    // Transferable if a skill they already have implies this one.
    let transferableFrom: string | undefined
    for (const cs of candidateSkills) {
      const cc = canon(cs)
      if ((IMPLY[cc] || []).some((i) => canon(i).toLowerCase() === key)) { transferableFrom = cc; break }
    }
    out.push({ skill: name, lift, transferableFrom })
  }
  return out.sort((a, b) => b.lift - a.lift).slice(0, max)
}
