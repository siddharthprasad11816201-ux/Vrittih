/* AIOS providers for the Phase 7-11 enterprise verticals. Thin orchestration over the
 * pure vertical libs: read the subject's REAL state from the DB, run the deterministic
 * engines, return structured, explainable output. Audited via the gateway. No external LLM. */
import { prisma } from "@/lib/prisma"
import { registerProvider } from "./execute"
import { ensureWorkspace } from "@/lib/workspace"
import { pipelineSummary, winRate, campaignPerformance, ticketHealth, salesAdvisor } from "@/lib/crm/revenue"

/* Phase 7 — AI Sales Assistant. Reads the caller's CRM workspace (deals/campaigns/tickets)
 * and returns a per-currency pipeline, win rate, forecast, and prioritised next actions. */
registerProvider("crm.sales.assistant", async (ctx) => {
  const uid = ctx.subjectId as string
  const { workspaceId } = await ensureWorkspace(uid)
  const [deals, campaigns, tickets] = await Promise.all([
    prisma.deal.findMany({ where: { workspaceId }, select: { amount: true, currency: true, stage: true, probability: true, closeAt: true, updatedAt: true, title: true }, take: 2000 }),
    prisma.campaign.findMany({ where: { workspaceId }, select: { name: true, channel: true, status: true, budget: true, currency: true, sent: true, opened: true, converted: true }, take: 500 }),
    prisma.ticket.findMany({ where: { workspaceId }, select: { status: true, priority: true, createdAt: true, resolvedAt: true }, take: 2000 }),
  ])
  const pipeline = pipelineSummary(deals)
  const win = winRate(deals)
  const camp = campaignPerformance(campaigns)
  const tix = ticketHealth(tickets)
  const advice = salesAdvisor({ deals, pipeline, win, campaigns: camp, tickets: tix })
  return { output: { advice, pipeline, win, campaigns: camp, tickets: tix }, explanation: advice.summary, confidence: 0.72, modelId: "sales-assistant-v1" }
})
