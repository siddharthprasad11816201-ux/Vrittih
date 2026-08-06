import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { featureGate } from "@/lib/guard"
import { ensureWorkspace, canWrite } from "@/lib/workspace"
import { pipelineSummary, winRate, campaignPerformance, ticketHealth, DEAL_STAGES, CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, TICKET_STATUSES, TICKET_PRIORITIES, defaultProbability } from "@/lib/crm/revenue"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
const num = (v: any) => Math.max(0, Number(v) || 0)
const cur = (v: any) => String(v || "CHF").toUpperCase().slice(0, 3)
const str = (v: any, n = 200) => String(v ?? "").slice(0, n)
const oneOf = (v: any, list: readonly string[], d: string) => (list.includes(String(v)) ? String(v) : d)

export async function GET(req: NextRequest) {
  const gate = await featureGate(req, "crm"); if (gate instanceof NextResponse) return gate
  const p = auth(req); if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { workspaceId } = await ensureWorkspace(p.userId)
  const [deals, campaigns, tickets] = await Promise.all([
    prisma.deal.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 1000 }),
    prisma.campaign.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.ticket.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 500 }),
  ])
  return NextResponse.json({
    deals, campaigns, tickets,
    pipeline: pipelineSummary(deals),
    win: winRate(deals),
    campaignPerf: campaignPerformance(campaigns),
    ticketHealth: ticketHealth(tickets),
    meta: { stages: DEAL_STAGES, channels: CAMPAIGN_CHANNELS, campaignStatuses: CAMPAIGN_STATUSES, ticketStatuses: TICKET_STATUSES, ticketPriorities: TICKET_PRIORITIES },
  })
}

export async function POST(req: NextRequest) {
  const gate = await featureGate(req, "crm"); if (gate instanceof NextResponse) return gate
  const p = auth(req); if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { workspaceId, role } = await ensureWorkspace(p.userId)
  if (!canWrite(role as any)) return NextResponse.json({ error: "Read-only access." }, { status: 403 })
  const b = await req.json()
  const action = str(b.action, 40)

  // Ownership helper: the record must belong to the caller's workspace.
  const ownsDeal = async (id: string) => (await prisma.deal.findUnique({ where: { id }, select: { workspaceId: true } }))?.workspaceId === workspaceId
  const ownsCampaign = async (id: string) => (await prisma.campaign.findUnique({ where: { id }, select: { workspaceId: true } }))?.workspaceId === workspaceId
  const ownsTicket = async (id: string) => (await prisma.ticket.findUnique({ where: { id }, select: { workspaceId: true } }))?.workspaceId === workspaceId

  if (action === "create-deal") {
    const title = str(b.title).trim(); if (!title) return NextResponse.json({ error: "Deal title required." }, { status: 400 })
    const stage = oneOf(b.stage, DEAL_STAGES, "LEAD")
    await prisma.deal.create({ data: { workspaceId, createdById: p.userId, title, contactId: b.contactId ? str(b.contactId, 40) : null, amount: num(b.amount), currency: cur(b.currency), stage, probability: b.probability != null ? Math.min(100, Math.max(0, Math.round(Number(b.probability)))) : defaultProbability(stage), ownerName: b.ownerName ? str(b.ownerName, 120) : null, source: b.source ? str(b.source, 80) : null, closeAt: b.closeAt ? new Date(b.closeAt) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "move-deal") {
    const id = str(b.dealId, 40); const stage = oneOf(b.stage, DEAL_STAGES, "")
    if (!stage) return NextResponse.json({ error: "Invalid stage." }, { status: 400 })
    if (!(await ownsDeal(id))) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const data: any = { stage }
    if (stage === "WON") data.probability = 100; else if (stage === "LOST") data.probability = 0
    await prisma.deal.update({ where: { id }, data })
    return NextResponse.json({ success: true })
  }
  if (action === "update-deal") {
    const id = str(b.dealId, 40); if (!(await ownsDeal(id))) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const data: any = {}
    if (b.amount != null) data.amount = num(b.amount)
    if (b.probability != null) data.probability = Math.min(100, Math.max(0, Math.round(Number(b.probability))))
    if (b.title != null) data.title = str(b.title)
    if (b.closeAt !== undefined) data.closeAt = b.closeAt ? new Date(b.closeAt) : null
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    await prisma.deal.update({ where: { id }, data })
    return NextResponse.json({ success: true })
  }
  if (action === "create-campaign") {
    const name = str(b.name).trim(); if (!name) return NextResponse.json({ error: "Campaign name required." }, { status: 400 })
    await prisma.campaign.create({ data: { workspaceId, createdById: p.userId, name, channel: oneOf(b.channel, CAMPAIGN_CHANNELS, "EMAIL"), status: oneOf(b.status, CAMPAIGN_STATUSES, "DRAFT"), budget: num(b.budget), currency: cur(b.currency), sent: Math.max(0, Math.round(Number(b.sent) || 0)), opened: Math.max(0, Math.round(Number(b.opened) || 0)), converted: Math.max(0, Math.round(Number(b.converted) || 0)), startAt: b.startAt ? new Date(b.startAt) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "update-campaign") {
    const id = str(b.campaignId, 40); if (!(await ownsCampaign(id))) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const data: any = {}
    if (b.status != null) data.status = oneOf(b.status, CAMPAIGN_STATUSES, "DRAFT")
    for (const k of ["sent", "opened", "converted"]) if (b[k] != null) data[k] = Math.max(0, Math.round(Number(b[k]) || 0))
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    await prisma.campaign.update({ where: { id }, data })
    return NextResponse.json({ success: true })
  }
  if (action === "create-ticket") {
    const subject = str(b.subject).trim(); if (!subject) return NextResponse.json({ error: "Ticket subject required." }, { status: 400 })
    await prisma.ticket.create({ data: { workspaceId, createdById: p.userId, contactId: b.contactId ? str(b.contactId, 40) : null, subject, body: b.body ? str(b.body, 5000) : null, priority: oneOf(b.priority, TICKET_PRIORITIES, "MEDIUM"), status: "OPEN", assignee: b.assignee ? str(b.assignee, 120) : null } })
    return NextResponse.json({ success: true }, { status: 201 })
  }
  if (action === "update-ticket") {
    const id = str(b.ticketId, 40); if (!(await ownsTicket(id))) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const status = oneOf(b.status, TICKET_STATUSES, "")
    if (!status) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
    await prisma.ticket.update({ where: { id }, data: { status, resolvedAt: (status === "RESOLVED" || status === "CLOSED") ? new Date() : null } })
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
