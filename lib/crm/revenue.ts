/* Enterprise CRM — Revenue Intelligence. PURE, testable, FX-SAFE.
 *
 * Phase 7. Deterministic sales analytics (NO external LLM): a weighted sales pipeline,
 * win rate, a probability-weighted forecast, campaign performance, and support-ticket
 * health. EVERY monetary figure is grouped by currency and NEVER summed across
 * currencies (conversion is a separate, explicit step via lib/fx). Feeds the AI Sales
 * Assistant (lib/aios ops-providers).
 */

export const DEAL_STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const
export const OPEN_STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] as const
export const CAMPAIGN_CHANNELS = ["EMAIL", "SOCIAL", "EVENT", "ADS", "CONTENT"] as const
export const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "DONE"] as const
export const TICKET_STATUSES = ["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const

const money = (v: any) => Math.max(0, Number(v) || 0)
const CUR = (c: any) => String(c || "CHF").toUpperCase()
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
const clampPct = (n: any) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)))

export interface DealLite { amount: number; currency: string; stage: string; probability?: number; closeAt?: any; updatedAt?: any; title?: string }

export interface StageBucket { stage: string; count: number; value: number; weighted: number }
export interface PipelineRollup {
  currency: string
  openValue: number       // sum of open-deal amounts
  weightedValue: number   // Σ amount·probability/100 over open deals (the forecast)
  wonValue: number
  lostValue: number
  openCount: number
  stages: StageBucket[]
}

/* Per-currency pipeline: open value, probability-weighted forecast, won/lost, by stage. */
export function pipelineSummary(deals: DealLite[]): PipelineRollup[] {
  const map = new Map<string, PipelineRollup>()
  const get = (c: string) => {
    const k = CUR(c)
    if (!map.has(k)) map.set(k, { currency: k, openValue: 0, weightedValue: 0, wonValue: 0, lostValue: 0, openCount: 0, stages: DEAL_STAGES.map(s => ({ stage: s, count: 0, value: 0, weighted: 0 })) })
    return map.get(k)!
  }
  for (const d of deals) {
    const r = get(d.currency), amt = money(d.amount)
    const stage = (DEAL_STAGES as readonly string[]).includes(d.stage) ? d.stage : "LEAD"
    const bucket = r.stages.find(s => s.stage === stage)!
    bucket.count++; bucket.value = round2(bucket.value + amt)
    if (stage === "WON") r.wonValue += amt
    else if (stage === "LOST") r.lostValue += amt
    else {
      const prob = clampPct(d.probability ?? defaultProbability(stage))
      const w = amt * prob / 100
      r.openValue += amt; r.weightedValue += w; r.openCount++
      bucket.weighted = round2(bucket.weighted + w)
    }
  }
  const out = [...map.values()]
  for (const r of out) { r.openValue = round2(r.openValue); r.weightedValue = round2(r.weightedValue); r.wonValue = round2(r.wonValue); r.lostValue = round2(r.lostValue) }
  return out.sort((a, b) => b.weightedValue - a.weightedValue)
}

/* Sensible default win-probability per stage when a deal doesn't carry its own. */
export function defaultProbability(stage: string): number {
  return { LEAD: 10, QUALIFIED: 30, PROPOSAL: 55, NEGOTIATION: 75, WON: 100, LOST: 0 }[stage] ?? 10
}

export interface WinRate { won: number; lost: number; rate: number }
/* Win rate over closed deals (won / (won+lost)). */
export function winRate(deals: DealLite[]): WinRate {
  let won = 0, lost = 0
  for (const d of deals) { if (d.stage === "WON") won++; else if (d.stage === "LOST") lost++ }
  const closed = won + lost
  return { won, lost, rate: closed ? Math.round((won / closed) * 100) : 0 }
}

// ---- Campaigns ----
export interface CampaignLite { name: string; channel?: string; status?: string; budget: number; currency: string; sent: number; opened: number; converted: number }
export interface CampaignPerf { name: string; channel: string; openRate: number; convRate: number; costPerConv: number | null; currency: string; converted: number }

/* Per-campaign performance. costPerConv stays per-currency (never cross-currency). */
export function campaignPerformance(campaigns: CampaignLite[]): CampaignPerf[] {
  return campaigns.map(c => {
    const sent = Math.max(0, Math.round(c.sent || 0))
    const opened = Math.max(0, Math.round(c.opened || 0))
    const converted = Math.max(0, Math.round(c.converted || 0))
    const budget = money(c.budget)
    return {
      name: c.name, channel: c.channel || "EMAIL", currency: CUR(c.currency), converted,
      openRate: sent ? Math.round((opened / sent) * 100) : 0,
      convRate: sent ? Math.round((converted / sent) * 100) : 0,
      costPerConv: converted > 0 ? round2(budget / converted) : null,
    }
  }).sort((a, b) => b.convRate - a.convRate)
}

// ---- Tickets ----
export interface TicketLite { status: string; priority?: string; createdAt?: any; resolvedAt?: any }
export interface TicketHealth {
  open: number; pending: number; resolved: number; closed: number
  backlog: number            // OPEN + PENDING
  urgentOpen: number
  byPriority: Record<string, number>
  avgResolutionHours: number | null
  band: "healthy" | "watch" | "overloaded"
}
const DAY = 864e5
export function ticketHealth(tickets: TicketLite[], now = Date.now()): TicketHealth {
  let open = 0, pending = 0, resolved = 0, closed = 0, urgentOpen = 0, resSum = 0, resN = 0
  const byPriority: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 }
  for (const t of tickets) {
    const isOpen = t.status === "OPEN" || t.status === "PENDING"
    if (t.status === "OPEN") open++
    else if (t.status === "PENDING") pending++
    else if (t.status === "RESOLVED") resolved++
    else if (t.status === "CLOSED") closed++
    if (isOpen) { const p = (TICKET_PRIORITIES as readonly string[]).includes(t.priority || "") ? t.priority! : "MEDIUM"; byPriority[p]++; if (p === "URGENT") urgentOpen++ }
    if ((t.status === "RESOLVED" || t.status === "CLOSED") && t.resolvedAt && t.createdAt) {
      const a = +new Date(t.createdAt), b = +new Date(t.resolvedAt)
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) { resSum += (b - a) / 36e5; resN++ }
    }
  }
  const backlog = open + pending
  const band: TicketHealth["band"] = urgentOpen > 0 || backlog > 20 ? "overloaded" : backlog > 8 ? "watch" : "healthy"
  return { open, pending, resolved, closed, backlog, urgentOpen, byPriority, avgResolutionHours: resN ? round2(resSum / resN) : null, band }
}

// ---- Sales advisor: prioritised, explainable next-best-actions ----
export type Severity = "urgent" | "high" | "medium" | "low"
const SEV: Record<Severity, number> = { urgent: 4, high: 3, medium: 2, low: 1 }
export interface SalesSuggestion { id: string; title: string; detail: string; severity: Severity; action: { label: string; href: string } }
export interface SalesAdvice { summary: string; suggestions: SalesSuggestion[] }

/* Deterministic sales advisor. Amounts are always stated with their currency. */
export function salesAdvisor(input: { deals: DealLite[]; pipeline: PipelineRollup[]; win: WinRate; campaigns: CampaignPerf[]; tickets: TicketHealth }, now = Date.now()): SalesAdvice {
  const s: SalesSuggestion[] = []
  // Stale open deals (no update in 14+ days).
  const stale = input.deals.filter(d => (OPEN_STAGES as readonly string[]).includes(d.stage) && d.updatedAt && now - +new Date(d.updatedAt) > 14 * DAY)
  if (stale.length) s.push({ id: "stale-deals", title: `${stale.length} deal(s) going cold`, detail: `${stale.length} open deal(s) haven't moved in over two weeks — follow up before they slip.`, severity: "high", action: { label: "Open pipeline", href: "/sales" } })
  // High-value negotiation deals to close.
  for (const r of input.pipeline) {
    const negoBucket = r.stages.find(x => x.stage === "NEGOTIATION")
    if (negoBucket && negoBucket.value > 0) s.push({ id: `close-${r.currency}`, title: `${r.currency} ${negoBucket.value.toLocaleString()} in negotiation`, detail: `${negoBucket.count} deal(s) are one step from won — prioritise closing them.`, severity: "high", action: { label: "Open pipeline", href: "/sales" } })
  }
  // Overloaded support.
  if (input.tickets.urgentOpen > 0) s.push({ id: "urgent-tickets", title: `${input.tickets.urgentOpen} urgent ticket(s) open`, detail: `Urgent customer issues are unresolved — a churn risk. Triage now.`, severity: "urgent", action: { label: "Open support", href: "/sales" } })
  else if (input.tickets.band === "overloaded") s.push({ id: "ticket-backlog", title: `Support backlog is ${input.tickets.backlog}`, detail: `The support queue is building up — resolve or reassign to keep SLAs.`, severity: "medium", action: { label: "Open support", href: "/sales" } })
  // Low win rate.
  if (input.win.won + input.win.lost >= 5 && input.win.rate < 30) s.push({ id: "win-rate", title: `Win rate is ${input.win.rate}%`, detail: `Fewer than a third of closed deals are won — revisit qualification and pricing.`, severity: "medium", action: { label: "Review deals", href: "/sales" } })
  // Underperforming active campaigns.
  const weak = input.campaigns.filter(c => c.convRate === 0 && c.costPerConv === null)
  if (weak.length) s.push({ id: "weak-campaigns", title: `${weak.length} campaign(s) with no conversions`, detail: `${weak.map(w => w.name).slice(0, 2).join(", ")} aren't converting — refine targeting or messaging.`, severity: "low", action: { label: "Review campaigns", href: "/sales" } })

  s.sort((a, b) => SEV[b.severity] - SEV[a.severity])
  const urgent = s.filter(x => x.severity === "urgent").length
  const summary = s.length === 0 ? "Revenue engine looks healthy — no pressing actions." : `${s.length} recommendation${s.length > 1 ? "s" : ""}${urgent ? `, ${urgent} urgent` : ""}.`
  return { summary, suggestions: s }
}
