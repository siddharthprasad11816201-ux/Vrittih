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

import { deliberate } from "@/lib/intelligence/deliberate"
import { grievanceSLA, schemeReach, serviceBacklog, policyBrief } from "@/lib/government/policy"

/* Phase 11 — Policy Intelligence. Aggregates the caller's agencies (schemes + citizen
 * requests), computes SLA/reach/backlog, then routes an evidence Brief through the
 * Enterprise Brain for an explainable, confidence-scored verdict + recommendations. */
registerProvider("gov.policy.intelligence", async (ctx) => {
  const uid = ctx.subjectId as string
  const agencies = await prisma.govAgency.findMany({ where: { ownerId: uid }, select: { id: true } })
  const ids = agencies.map(a => a.id)
  const [schemes, requests] = ids.length ? await Promise.all([
    prisma.scheme.findMany({ where: { agencyId: { in: ids } }, select: { name: true, budget: true, currency: true, beneficiaries: true, status: true }, take: 2000 }),
    prisma.citizenRequest.findMany({ where: { agencyId: { in: ids } }, select: { kind: true, status: true, priority: true, category: true, slaDays: true, createdAt: true, resolvedAt: true }, take: 5000 }),
  ]) : [[], []]
  const sla = grievanceSLA(requests as any)
  const reach = schemeReach(schemes as any)
  const backlog = serviceBacklog(requests as any)
  const d = deliberate(policyBrief(sla, backlog, reach))
  return { output: { sla, reach, backlog, deliberation: { verdict: d.decision.verdict, confidence: d.confidence, why: d.explanation, risks: d.risks }, hasData: ids.length > 0 }, explanation: d.explanation, confidence: d.confidence, modelId: "policy-intelligence-v1" }
})

import { appointmentStats, populationHealth, clinicalOpsBrief } from "@/lib/healthcare/clinical"

/* Phase 12 — Clinical Operations Assistant. Aggregates the caller's facilities (patients,
 * appointments, records), computes operational metrics, and routes an evidence Brief through
 * the Enterprise Brain. OPERATIONAL only — never diagnosis or medical advice. */
registerProvider("health.clinical.assistant", async (ctx) => {
  const uid = ctx.subjectId as string
  const facilities = await prisma.healthFacility.findMany({ where: { ownerId: uid }, select: { id: true } })
  const ids = facilities.map(f => f.id)
  const [patients, appts, recordCount] = ids.length ? await Promise.all([
    prisma.patient.findMany({ where: { facilityId: { in: ids } }, select: { dob: true, bloodGroup: true }, take: 20000 }),
    prisma.appointment.findMany({ where: { facilityId: { in: ids } }, select: { status: true, scheduledAt: true }, take: 20000 }),
    prisma.medicalRecord.findMany({ where: { facilityId: { in: ids } }, select: { patientId: true }, take: 50000 }).then(rs => new Set(rs.map(r => r.patientId)).size),
  ]) : [[], [], 0]
  const stats = appointmentStats(appts as any)
  const pop = populationHealth(patients as any)
  const recordsCoverage = pop.patients > 0 ? Math.round(((recordCount as number) / pop.patients) * 100) : 0
  const d = deliberate(clinicalOpsBrief(stats, pop, recordsCoverage))
  return { output: { stats, population: pop, recordsCoverage, deliberation: { verdict: d.decision.verdict, confidence: d.confidence, why: d.explanation, risks: d.risks }, hasData: ids.length > 0 }, explanation: d.explanation, confidence: d.confidence, modelId: "clinical-assistant-v1" }
})

import { attritionBrief, promotionBrief, type EmployeeSignals } from "@/lib/hr/workforce"

/* Phase 6 HCM — HR Copilot. Reads the caller's real workforce (employees + their latest
 * performance review, goals, recognition, 1:1s, succession status), builds evidence Briefs,
 * and routes EACH through the Enterprise Brain for evidence-based attrition risk + promotion
 * readiness. Returns the ranked risks + promotion-ready list with why/confidence/risks. */
registerProvider("hr.copilot", async (ctx) => {
  const uid = ctx.subjectId as string
  const now = Date.now()
  const employees = await prisma.employee.findMany({ where: { employerId: uid, status: { in: ["ACTIVE", "ONBOARDING", "ON_LEAVE"] } }, select: { id: true, userId: true, joinedAt: true, designation: true }, take: 2000 })
  if (!employees.length) return { output: { attritionRisks: [], promotionReady: [], workforce: 0, summary: "No employees on record yet." }, explanation: "No workforce data yet.", confidence: 0.3, modelId: "hr-copilot-v1" }

  const userIds = employees.map(e => e.userId)
  const [users, reviews, goals, recos, oneOnOnes, succession] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
    prisma.performanceReview.findMany({ where: { subjectId: { in: userIds }, status: { not: "DRAFT" } }, select: { subjectId: true, overall: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.goal.findMany({ where: { ownerId: { in: userIds } }, select: { ownerId: true, status: true, progress: true } }),
    prisma.recognition.findMany({ where: { toId: { in: userIds }, createdAt: { gte: new Date(now - 90 * 864e5) } }, select: { toId: true } }),
    prisma.oneOnOne.findMany({ where: { employeeId: { in: [...userIds, ...employees.map(e => e.id)] } }, select: { employeeId: true, createdAt: true }, orderBy: { createdAt: "desc" } }).catch(() => [] as any[]),
    prisma.successionPlan.findMany({ where: { ownerId: uid }, select: { candidates: true } }).catch(() => [] as any[]),
  ])
  const uName = new Map(users.map(u => [u.id, u.name || u.email || "Employee"]))
  const latestRating = new Map<string, number | null>(); for (const r of reviews) if (!latestRating.has(r.subjectId)) latestRating.set(r.subjectId, r.overall ?? null)
  const goalBy = new Map<string, { active: number; achieved: number; prog: number[] }>()
  for (const g of goals) { const e = goalBy.get(g.ownerId) || { active: 0, achieved: 0, prog: [] }; if (g.status === "ACTIVE") { e.active++; e.prog.push(g.progress || 0) } else if (g.status === "ACHIEVED") e.achieved++; goalBy.set(g.ownerId, e) }
  const recoBy = new Map<string, number>(); for (const r of recos) recoBy.set(r.toId, (recoBy.get(r.toId) || 0) + 1)
  const lastO = new Map<string, number>(); for (const o of oneOnOnes as any[]) { if (o.employeeId && !lastO.has(o.employeeId)) lastO.set(o.employeeId, +new Date(o.createdAt)) }
  const successionUsers = new Set<string>(); for (const s of succession as any[]) { try { for (const c of JSON.parse(s.candidates || "[]")) if (c.userId) successionUsers.add(String(c.userId)) } catch {} }

  const attritionRisks: any[] = [], promotionReady: any[] = []
  for (const e of employees) {
    const g = goalBy.get(e.userId) || { active: 0, achieved: 0, prog: [] }
    const sig: EmployeeSignals = {
      name: uName.get(e.userId) || "Employee",
      tenureMonths: Math.max(0, Math.round((now - +new Date(e.joinedAt)) / (30.4 * 864e5))),
      latestRating: latestRating.get(e.userId) ?? null,
      goalsActive: g.active, goalsAchieved: g.achieved,
      avgGoalProgress: g.prog.length ? Math.round(g.prog.reduce((a, b) => a + b, 0) / g.prog.length) : 0,
      recognitions90d: recoBy.get(e.userId) || 0,
      lastOneOnOneDays: (() => { const k = lastO.has(e.userId) ? e.userId : (lastO.has(e.id) ? e.id : null); return k ? Math.round((now - lastO.get(k)!) / 864e5) : null })(),
      inSuccessionPlan: successionUsers.has(e.userId),
    }
    const a = deliberate(attritionBrief(sig))
    if (a.decision.verdict === "supported" || a.decision.verdict === "uncertain") attritionRisks.push({ userId: e.userId, name: sig.name, designation: e.designation, verdict: a.decision.verdict, confidence: a.confidence, why: a.explanation, risks: a.risks })
    const pr = deliberate(promotionBrief(sig))
    if (pr.decision.verdict === "supported") promotionReady.push({ userId: e.userId, name: sig.name, designation: e.designation, confidence: pr.confidence, why: pr.explanation })
  }
  attritionRisks.sort((x, y) => y.confidence - x.confidence)
  promotionReady.sort((x, y) => y.confidence - x.confidence)
  const summary = `${employees.length} employees analysed — ${attritionRisks.filter(r => r.verdict === "supported").length} flagged attrition risk, ${promotionReady.length} promotion-ready (evidence-based).`
  return { output: { attritionRisks: attritionRisks.slice(0, 50), promotionReady: promotionReady.slice(0, 50), workforce: employees.length, summary }, explanation: summary, confidence: 0.72, modelId: "hr-copilot-v1" }
})
