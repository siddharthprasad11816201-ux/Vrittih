/* Talent CRM — pool taxonomy, member stages & pipeline health. PURE, testable.
 *
 * EROS Module 4. Enterprise talent-relationship primitives: the kinds of talent pool a
 * team runs, the relationship stages a candidate moves through, and a deterministic,
 * explainable pipeline-health score (engagement mix + freshness + size). No inference
 * about people — just the state of the relationship, which a recruiter acts on.
 */

export const POOL_KINDS = [
  { key: "POOL", label: "Talent pool" },
  { key: "SILVER_MEDALIST", label: "Silver medalists" },
  { key: "CAMPUS", label: "Campus pipeline" },
  { key: "ALUMNI", label: "Alumni" },
  { key: "REFERRAL", label: "Referral network" },
  { key: "PASSIVE", label: "Passive candidates" },
  { key: "COMMUNITY", label: "Talent community" },
  { key: "RESEARCH", label: "Research community" },
] as const
export type PoolKind = (typeof POOL_KINDS)[number]["key"]
export const poolKindLabel = (k: string) => POOL_KINDS.find(p => p.key === k)?.label || k

// Relationship stages (ordered). Engaged/Interested count as "warm".
export const MEMBER_STAGES = ["NEW", "CONTACTED", "ENGAGED", "INTERESTED", "NURTURING", "CONVERTED", "DORMANT"] as const
export type MemberStage = (typeof MEMBER_STAGES)[number]
export const MEMBER_STAGE_LABEL: Record<MemberStage, string> = {
  NEW: "New", CONTACTED: "Contacted", ENGAGED: "Engaged", INTERESTED: "Interested",
  NURTURING: "Nurturing", CONVERTED: "Converted", DORMANT: "Dormant",
}
const WARM: MemberStage[] = ["ENGAGED", "INTERESTED", "NURTURING"]

const DAY = 864e5

export interface PoolMember { stage: string; addedAt: number | string | Date; lastActivityAt?: number | string | Date | null }
export interface PipelineHealth {
  score: number                 // 0..100 deterministic
  band: "healthy" | "steady" | "cooling" | "cold"
  size: number
  byStage: Record<string, number>
  warmRate: number              // share in warm stages (0..1)
  freshRate: number             // share active in last 30d (0..1)
  convertedRate: number
  note: string
}

function ms(v: any): number { const n = +new Date(v as any); return Number.isFinite(n) ? n : 0 }

/* Health = engagement (warm + converted) tempered by freshness, gated by size.
 * A small or stale pool scores lower; an actively-engaged one scores higher. */
export function pipelineHealth(members: PoolMember[], now = Date.now()): PipelineHealth {
  const size = members.length
  const byStage: Record<string, number> = {}
  for (const m of members) byStage[m.stage] = (byStage[m.stage] || 0) + 1
  if (size === 0) {
    return { score: 0, band: "cold", size: 0, byStage, warmRate: 0, freshRate: 0, convertedRate: 0, note: "Empty pool — add candidates to start building the relationship." }
  }
  const warm = members.filter(m => WARM.includes(m.stage as MemberStage)).length
  const converted = members.filter(m => m.stage === "CONVERTED").length
  const fresh = members.filter(m => {
    // resolve by VALIDITY not truthiness — an unparseable lastActivityAt falls back to
    // addedAt rather than being wrongly counted stale.
    const la = ms(m.lastActivityAt)
    const t = la > 0 ? la : ms(m.addedAt)
    return t > 0 && now - t <= 30 * DAY
  }).length
  const warmRate = warm / size
  const convertedRate = converted / size
  const freshRate = fresh / size
  const sizeFactor = Math.min(1, size / 10)
  // engagement 55%, freshness 30%, plus a converted bonus; scaled by pool size.
  const raw = (warmRate * 0.45 + convertedRate * 0.25 + freshRate * 0.30) * sizeFactor * 100
  const score = Math.round(Math.max(0, Math.min(100, raw)))
  const band = score >= 60 ? "healthy" : score >= 35 ? "steady" : score >= 15 ? "cooling" : "cold"
  const note = freshRate < 0.2
    ? "Engagement is going stale — reach out to warm the pipeline."
    : warmRate < 0.2
      ? "Few warm relationships — nurture new members toward engagement."
      : "Pipeline is actively engaged."
  return { score, band, size, byStage, warmRate: +warmRate.toFixed(2), freshRate: +freshRate.toFixed(2), convertedRate: +convertedRate.toFixed(2), note }
}
