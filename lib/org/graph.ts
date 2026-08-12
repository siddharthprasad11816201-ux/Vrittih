/**
 * Organizational talent graph — temporal semantics. PURE, no I/O, no clock reads.
 *
 * §57 is the hard requirement here: PREVIOUS, CURRENT, UPCOMING and FORECAST must never be
 * mixed. Conflating them is how a workforce plan starts reporting aspirational headcount as
 * if it were staffed, or counts a role somebody left last year as an open vacancy.
 *
 * So temporal state is DERIVED from explicit dates + a lifecycle state, every position
 * lands in exactly one bucket, and the classifier is total — there is no "unknown" hole
 * that silently defaults into "current".
 */

/** Where a unit sits in the tree. One self-referencing model beats three parallel ones. */
export const ORG_UNIT_KINDS = ["ORGANIZATION", "DEPARTMENT", "TEAM"] as const
export type OrgUnitKind = (typeof ORG_UNIT_KINDS)[number]

/** Only these nestings are legal, so the tree cannot become a soup. */
const LEGAL_PARENT: Record<OrgUnitKind, OrgUnitKind[]> = {
  ORGANIZATION: [],                        // a root has no parent
  DEPARTMENT: ["ORGANIZATION", "DEPARTMENT"],
  TEAM: ["DEPARTMENT", "TEAM", "ORGANIZATION"],
}

export function canNest(child: OrgUnitKind, parent: OrgUnitKind | null): { ok: true } | { ok: false; reason: string } {
  if (!parent) {
    return child === "ORGANIZATION"
      ? { ok: true }
      : { ok: false, reason: `A ${child.toLowerCase()} must sit inside a parent unit.` }
  }
  return LEGAL_PARENT[child]?.includes(parent)
    ? { ok: true }
    : { ok: false, reason: `A ${child.toLowerCase()} cannot sit directly inside a ${parent.toLowerCase()}.` }
}

/* ---------------- positions ---------------- */

/**
 * The lifecycle a role slot is IN, as recorded by a human.
 * Distinct from its TEMPORAL bucket, which is derived below from state + dates.
 */
export const POSITION_STATES = ["FILLED", "OPEN", "PLANNED", "FORECAST", "CLOSED"] as const
export type PositionState = (typeof POSITION_STATES)[number]

/** The four buckets §57 requires be kept apart. */
export const TEMPORAL = ["PREVIOUS", "CURRENT", "UPCOMING", "FORECAST"] as const
export type Temporal = (typeof TEMPORAL)[number]

export interface PositionLike {
  state: string
  /** When the role starts / started being real. */
  effectiveFrom?: Date | string | null
  /** When it ended (a closed or historical slot). */
  effectiveTo?: Date | string | null
}

const asDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Classify a position into exactly one temporal bucket.
 *
 *   PREVIOUS — closed, or its effective window has ended. Historical only.
 *   CURRENT  — filled now, or open and already effective (a live vacancy).
 *   UPCOMING — approved/planned with a start date in the future. Real, not yet live.
 *   FORECAST — modelled demand. NOT approved headcount and must never be counted as such.
 *
 * The order of checks matters: an ended window wins over everything, because a role that
 * finished is history regardless of what its state field still says.
 */
export function temporalOf(p: PositionLike, now: Date): Temporal {
  const from = asDate(p.effectiveFrom)
  const to = asDate(p.effectiveTo)

  if (to && to.getTime() <= now.getTime()) return "PREVIOUS"
  if (p.state === "CLOSED") return "PREVIOUS"
  if (p.state === "FORECAST") return "FORECAST"
  if (from && from.getTime() > now.getTime()) return "UPCOMING"
  if (p.state === "PLANNED") return "UPCOMING"     // planned with no date is still not live
  if (p.state === "FILLED" || p.state === "OPEN") return "CURRENT"
  return "UPCOMING"                                 // total: an unknown state is never CURRENT
}

/** Group positions into the four buckets. Every input lands in exactly one. */
export function bucketByTemporal<T extends PositionLike>(positions: T[], now: Date): Record<Temporal, T[]> {
  const out: Record<Temporal, T[]> = { PREVIOUS: [], CURRENT: [], UPCOMING: [], FORECAST: [] }
  for (const p of positions) out[temporalOf(p, now)].push(p)
  return out
}

/** Only these count as approved headcount. FORECAST is deliberately excluded. */
export function isApprovedHeadcount(t: Temporal): boolean {
  return t === "CURRENT" || t === "UPCOMING"
}

export interface HeadcountSummary {
  filled: number
  open: number
  upcoming: number
  forecast: number
  /** Approved = filled + open + upcoming. Forecast is reported SEPARATELY, never added. */
  approved: number
  previous: number
}

export function headcount(positions: (PositionLike & { headcount?: number })[], now: Date): HeadcountSummary {
  const n = (p: any) => Math.max(0, Math.floor(p.headcount ?? 1))
  const s: HeadcountSummary = { filled: 0, open: 0, upcoming: 0, forecast: 0, approved: 0, previous: 0 }
  for (const p of positions) {
    const t = temporalOf(p, now)
    if (t === "PREVIOUS") { s.previous += n(p); continue }
    if (t === "FORECAST") { s.forecast += n(p); continue }
    if (t === "UPCOMING") { s.upcoming += n(p); continue }
    if (p.state === "FILLED") s.filled += n(p)
    else s.open += n(p)
  }
  s.approved = s.filled + s.open + s.upcoming
  return s
}

/* ---------------- tree ---------------- */

export interface UnitNode { id: string; parentId?: string | null; kind: string; name: string }

/** Ancestor chain root-first. Cycle-safe: a corrupt parent link cannot hang the request. */
export function pathOf(units: UnitNode[], id: string): UnitNode[] {
  const byId = new Map(units.map((u) => [u.id, u]))
  const out: UnitNode[] = []
  const seen = new Set<string>()
  let cur = byId.get(id)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    out.unshift(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return out
}

/** Every descendant id including the unit itself — the scope of a "department-wide" query. */
export function subtreeIds(units: UnitNode[], rootId: string): string[] {
  const children = new Map<string, string[]>()
  for (const u of units) {
    if (!u.parentId) continue
    const arr = children.get(u.parentId) || []
    arr.push(u.id)
    children.set(u.parentId, arr)
  }
  const out: string[] = []
  const stack = [rootId]
  const seen = new Set<string>()
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    for (const c of children.get(id) || []) stack.push(c)
  }
  return out
}

/** Would setting `parentId` on `unitId` create a cycle? */
export function wouldCycle(units: UnitNode[], unitId: string, parentId: string): boolean {
  if (unitId === parentId) return true
  return subtreeIds(units, unitId).includes(parentId)
}
