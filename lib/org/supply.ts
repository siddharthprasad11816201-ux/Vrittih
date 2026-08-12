/**
 * Workforce supply / demand / gap analysis. PURE — no I/O, no clock.
 *
 * Answers the §30 and §58 questions from real rows: which skills are in demand, which
 * departments have gaps, and which upcoming roles have insufficient candidate supply.
 *
 * The temporal discipline from graph.ts is preserved throughout: FORECAST demand is
 * tracked SEPARATELY from approved demand and never silently added to it, because acting
 * on modelled demand as though it were approved headcount is how hiring plans go wrong.
 */
import { temporalOf, type PositionLike, type Temporal } from "./graph"

export interface PositionDemand extends PositionLike {
  id: string
  title: string
  orgUnitId?: string | null
  headcount?: number
  /** Canonical skill names this role needs. */
  skills: string[]
}

/** A person who could supply a skill: an employee who has it, or a candidate. */
export interface SupplyPerson {
  id: string
  kind: "employee" | "candidate"
  /** skill -> strength 0..1. Verified evidence should already be reflected here. */
  skills: Record<string, number>
}

export interface SkillDemand {
  skill: string
  /** Openings needing this skill that are CURRENT or UPCOMING (approved). */
  approvedDemand: number
  /** Openings needing this skill that are FORECAST only. Reported separately. */
  forecastDemand: number
  /** People who can supply it at or above the bar. */
  supply: number
  /** approvedDemand - supply. Positive = short. */
  gap: number
  /** Ratio of supply to approved demand; null when there is no approved demand. */
  coverage: number | null
}

export const SUPPLY_BAR = 0.5

/**
 * Compute per-skill demand and supply.
 *
 * FILLED positions are excluded from demand — the seat already has someone in it, so
 * counting it as demand would invent a shortage that does not exist.
 */
export function skillDemand(
  positions: PositionDemand[],
  people: SupplyPerson[],
  now: Date,
  bar = SUPPLY_BAR,
): SkillDemand[] {
  const approved = new Map<string, number>()
  const forecast = new Map<string, number>()

  for (const p of positions) {
    const t = temporalOf(p, now)
    if (t === "PREVIOUS") continue
    if (p.state === "FILLED") continue
    const n = Math.max(1, Math.floor(p.headcount ?? 1))
    const target = t === "FORECAST" ? forecast : approved
    for (const raw of p.skills || []) {
      const s = norm(raw)
      if (!s) continue
      target.set(s, (target.get(s) || 0) + n)
    }
  }

  const supply = new Map<string, number>()
  for (const person of people) {
    for (const [raw, strength] of Object.entries(person.skills || {})) {
      const s = norm(raw)
      if (!s || strength < bar) continue
      supply.set(s, (supply.get(s) || 0) + 1)
    }
  }

  const skills = new Set<string>([...approved.keys(), ...forecast.keys()])
  const out: SkillDemand[] = []
  for (const skill of skills) {
    const a = approved.get(skill) || 0
    const f = forecast.get(skill) || 0
    const s = supply.get(skill) || 0
    out.push({
      skill,
      approvedDemand: a,
      forecastDemand: f,
      supply: s,
      gap: Math.max(0, a - s),
      coverage: a > 0 ? +Math.min(2, s / a).toFixed(2) : null,
    })
  }
  // Worst shortages first, then by demand size — deterministic for equal gaps.
  out.sort((x, y) => y.gap - x.gap || y.approvedDemand - x.approvedDemand || x.skill.localeCompare(y.skill))
  return out
}

const norm = (s: string) => String(s || "").trim().toLowerCase()

export interface UnitGap {
  orgUnitId: string
  approvedOpenings: number
  forecastOpenings: number
  /** Skills short of supply, worst first. */
  shortSkills: { skill: string; gap: number }[]
  /** 0..1 — how well the unit's approved demand is covered. null when it has none. */
  coverage: number | null
}

/** Per-unit gap rollup: "which departments have skill gaps?" */
export function unitGaps(positions: PositionDemand[], people: SupplyPerson[], now: Date, bar = SUPPLY_BAR): UnitGap[] {
  const byUnit = new Map<string, PositionDemand[]>()
  for (const p of positions) {
    const k = p.orgUnitId || "unassigned"
    const arr = byUnit.get(k) || []
    arr.push(p)
    byUnit.set(k, arr)
  }
  const out: UnitGap[] = []
  for (const [orgUnitId, list] of byUnit) {
    const demand = skillDemand(list, people, now, bar)
    const approvedOpenings = list.filter((p) => {
      const t = temporalOf(p, now)
      return p.state !== "FILLED" && (t === "CURRENT" || t === "UPCOMING")
    }).reduce((n, p) => n + Math.max(1, Math.floor(p.headcount ?? 1)), 0)
    const forecastOpenings = list.filter((p) => temporalOf(p, now) === "FORECAST")
      .reduce((n, p) => n + Math.max(1, Math.floor(p.headcount ?? 1)), 0)

    const withDemand = demand.filter((d) => d.approvedDemand > 0)
    const coverage = withDemand.length
      ? +(withDemand.reduce((s, d) => s + Math.min(1, d.coverage ?? 0), 0) / withDemand.length).toFixed(2)
      : null

    out.push({
      orgUnitId,
      approvedOpenings,
      forecastOpenings,
      shortSkills: demand.filter((d) => d.gap > 0).map((d) => ({ skill: d.skill, gap: d.gap })).slice(0, 20),
      coverage,
    })
  }
  out.sort((a, b) => (a.coverage ?? 1) - (b.coverage ?? 1) || b.approvedOpenings - a.approvedOpenings)
  return out
}

export interface RoleSupply {
  positionId: string
  title: string
  temporal: Temporal
  requiredSkills: string[]
  /** People meeting at least `minCoverage` of the required skills. */
  qualified: number
  /** Best-matching people, strongest first. */
  top: { personId: string; kind: "employee" | "candidate"; coverage: number; missing: string[] }[]
  sufficient: boolean
}

export const MIN_COVERAGE = 0.6
/** How many qualified people a single opening should have available. */
export const SUPPLY_TARGET = 3

/**
 * "Which upcoming roles have insufficient candidate supply?"
 * A role with no listed skills cannot be assessed, and is reported as such rather than
 * being scored as fully covered.
 */
export function roleSupply(
  positions: PositionDemand[],
  people: SupplyPerson[],
  now: Date,
  opts: { minCoverage?: number; target?: number; bar?: number } = {},
): RoleSupply[] {
  const minCoverage = opts.minCoverage ?? MIN_COVERAGE
  const target = opts.target ?? SUPPLY_TARGET
  const bar = opts.bar ?? SUPPLY_BAR

  return positions.map((p) => {
    const required = [...new Set((p.skills || []).map(norm).filter(Boolean))]
    const scored = people.map((person) => {
      const missing = required.filter((s) => (person.skills?.[s] ?? person.skills?.[s.toLowerCase()] ?? 0) < bar)
      const coverage = required.length ? +((required.length - missing.length) / required.length).toFixed(2) : 0
      return { personId: person.id, kind: person.kind, coverage, missing }
    })
    const qualified = required.length ? scored.filter((s) => s.coverage >= minCoverage).length : 0
    return {
      positionId: p.id,
      title: p.title,
      temporal: temporalOf(p, now),
      requiredSkills: required,
      qualified,
      top: scored.sort((a, b) => b.coverage - a.coverage || a.personId.localeCompare(b.personId)).slice(0, 5),
      // A role with no required skills is NOT "sufficient" — it is unassessable.
      sufficient: required.length > 0 && qualified >= target,
    }
  }).sort((a, b) => a.qualified - b.qualified || a.title.localeCompare(b.title))
}
