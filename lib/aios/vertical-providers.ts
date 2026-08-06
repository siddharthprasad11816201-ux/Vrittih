/* AIOS providers for the Phase 7-11 enterprise verticals. Thin orchestration over the
 * pure vertical libs: read the subject's REAL state from the DB, run the deterministic
 * engines, return structured, explainable output. Audited via the gateway. No external LLM. */
import { prisma } from "@/lib/prisma"
import { registerProvider } from "./execute"
import { ensureWorkspace } from "@/lib/workspace"
import { pipelineSummary, winRate, campaignPerformance, ticketHealth, salesAdvisor } from "@/lib/crm/revenue"
import { admissionsFunnel, seatUtilization, placementStats, gpaDistribution, atRiskStudents, facultyRatio, campusAdvisor } from "@/lib/university/campus"

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

/* Phase 8 — Campus Intelligence. Aggregates across the caller's institution(s): admissions
 * funnel/yield, seat utilisation, placement, GPA distribution, at-risk students, ratio. */
registerProvider("university.intelligence", async (ctx) => {
  const uid = ctx.subjectId as string
  const insts = await prisma.institution.findMany({ where: { ownerId: uid }, select: { id: true } })
  const ids = insts.map(i => i.id)
  if (!ids.length) {
    const empty = { funnel: admissionsFunnel([]), seats: seatUtilization([], 0), placement: placementStats([]), gpa: gpaDistribution([]), atRisk: [], ratio: facultyRatio(0, 0) }
    const advice = campusAdvisor({ ...empty, atRisk: 0 })
    return { output: { ...empty, advice, hasData: false }, explanation: "No institution yet — create one to see campus intelligence.", confidence: 0.4, modelId: "campus-intelligence-v1" }
  }
  const [apps, programs, students, faculty] = await Promise.all([
    prisma.admissionApplication.findMany({ where: { institutionId: { in: ids } }, select: { status: true, score: true }, take: 5000 }),
    prisma.program.findMany({ where: { institutionId: { in: ids } }, select: { id: true, name: true, seats: true }, take: 500 }),
    prisma.studentRecord.findMany({ where: { institutionId: { in: ids } }, select: { status: true, gpa: true, placed: true, year: true, name: true }, take: 10000 }),
    prisma.facultyMember.count({ where: { institutionId: { in: ids } } }),
  ])
  const active = students.filter(s => s.status === "ACTIVE")
  const funnel = admissionsFunnel(apps)
  const seats = seatUtilization(programs, active.length)
  const placement = placementStats(students)
  const gpa = gpaDistribution(students)
  const risk = atRiskStudents(students)
  const ratio = facultyRatio(active.length, faculty)
  const advice = campusAdvisor({ funnel, seats, placement, gpa, atRisk: risk.length, ratio })
  return { output: { funnel, seats, placement, gpa, atRisk: risk.map(r => r.name), ratio, advice, hasData: true }, explanation: advice.summary, confidence: 0.72, modelId: "campus-intelligence-v1" }
})
