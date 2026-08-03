/* Organizational Health — metric EXTRACTION from the operational stores.
 *
 * This is the one intelligence module that touches Prisma: it batches queries,
 * turns raw aggregates into MetricSpec[] per domain, and rolls them up (score.ts).
 * The maths stays pure in score.ts / forecast.ts / decisions.ts.
 *
 * Grounded in the EIDP data reconnaissance: most operational tables (Application,
 * StatusEvent, Employee, Task, Internship, community) are currently EMPTY, so every
 * metric is null-safe — a domain with no data reports `null` (excluded from the index,
 * shown as "awaiting data") rather than a fabricated zero. The brain lights up as data
 * flows. Domains with real data today: AI, Financial, Identity/Security, Growth,
 * plus recruitment role-catalog freshness.
 */
import { prisma } from "@/lib/prisma"
import { PLANS } from "@/lib/plans"
import { scoreDomain, rollupHealth, pct, type MetricSpec, type DomainHealth, type OrgHealth } from "@/lib/intelligence/score"
import { bucketCounts, forecastSeries, type Forecast } from "@/lib/intelligence/forecast"
import { runDecisions, GENERIC_RULES, type DecisionCard, type DecisionRule } from "@/lib/intelligence/decisions"

const DAY = 864e5
const planPrice = (id: string) => PLANS.find(p => p.id === id)?.priceCHF ?? 0

export interface SeriesOut { key: string; label: string; points: number[]; forecast: Forecast }
export interface IntelligenceSnapshot {
  org: OrgHealth
  stats: Record<string, number | null>
  series: SeriesOut[]
  decisions: DecisionCard[]
  generatedAt: string
  coverageNote: string
}

/* Bucket a list of timestamps into `bins` weekly counts (oldest→newest) + forecast. */
function series(key: string, label: string, tsMs: number[], now: number, bins = 12, horizon = 4): SeriesOut {
  const points = bucketCounts(tsMs, 7 * DAY, bins, now)
  return { key, label, points, forecast: forecastSeries(points, horizon) }
}

/* A domain that has NO measured metric is "dark" — surface it as an actionable card
 * so leadership knows the intelligence is blind there, not that all is well. */
const darkDomainRule: DecisionRule = (ctx) => ctx.domains
  .filter(d => d.measured === 0 && d.total > 0)
  .map(d => ({
    id: `coverage:${d.domain}`,
    domain: d.domain,
    title: `${d.label} intelligence is dark`,
    severity: "medium" as const,
    recommendation: `No ${d.label.toLowerCase()} data is flowing yet — connect the source so this domain can be measured and forecast.`,
    evidence: [`0 of ${d.total} ${d.label.toLowerCase()} metrics have data.`],
    supportingMetrics: [{ label: "Metric coverage", value: `0/${d.total}`, band: null }],
    confidence: 0.9,
    alternatives: [`Start collecting ${d.label.toLowerCase()} events now.`, `Defer this domain until the workflow that produces it is live.`],
    risks: [`Decisions in ${d.label.toLowerCase()} are currently unsupported by data.`],
  }))

export async function computeIntelligence(now = Date.now()): Promise<IntelligenceSnapshot> {
  const d30 = new Date(now - 30 * DAY)
  const d90 = new Date(now - 90 * DAY)
  const d84 = new Date(now - 84 * DAY)

  const [
    userCount, paidCount, twoFACount, idVerCount, bannedCount, newUsers30d,
    planGroups, passkeyUsers, jobActive, jobFresh90d,
    appCount, hiredCount, offeredCount, interviewToApp,
    aiTotal, aiOk7d, ai7d, aiConf, aiSubjects,
    recCount, recSubjects, semDocs, memEntries, sem30d, mem30d,
    testCompleted, testPassed, certTotal, certRevoked,
    userTs, aiTs, appTs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { paid: true } }),
    prisma.user.count({ where: { twoFactorEnabled: true } }),
    prisma.user.count({ where: { idVerified: true } }),
    prisma.user.count({ where: { banned: true } }),
    prisma.user.count({ where: { createdAt: { gte: d30 } } }),
    prisma.user.groupBy({ by: ["plan"], where: { paid: true }, _count: { _all: true } }).catch(() => [] as any[]),
    prisma.webAuthnCredential.findMany({ distinct: ["userId"], select: { userId: true } }).then(r => r.length).catch(() => 0),
    prisma.job.count({ where: { active: true } }),
    prisma.job.count({ where: { active: true, createdAt: { gte: d90 } } }),
    prisma.application.count(),
    prisma.application.count({ where: { status: "HIRED" } }).catch(() => 0),
    prisma.application.count({ where: { status: "OFFERED" } }).catch(() => 0),
    prisma.application.count({ where: { status: "INTERVIEW" } }).catch(() => 0),
    prisma.aiRun.count(),
    prisma.aiRun.count({ where: { status: "ok", createdAt: { gte: new Date(now - 7 * DAY) } } }),
    prisma.aiRun.count({ where: { createdAt: { gte: new Date(now - 7 * DAY) } } }),
    prisma.aiRun.aggregate({ _avg: { confidence: true } }).catch(() => ({ _avg: { confidence: null } } as any)),
    prisma.aiRun.findMany({ where: { subjectId: { not: null } }, distinct: ["subjectId"], select: { subjectId: true } }).then(r => r.length).catch(() => 0),
    prisma.recommendation.count().catch(() => 0),
    prisma.recommendation.findMany({ distinct: ["subjectId"], select: { subjectId: true } }).then(r => r.length).catch(() => 0),
    prisma.semanticDoc.count().catch(() => 0),
    prisma.memoryEntry.count().catch(() => 0),
    prisma.semanticDoc.count({ where: { createdAt: { gte: d30 } } }).catch(() => 0),
    prisma.memoryEntry.count({ where: { createdAt: { gte: d30 } } }).catch(() => 0),
    prisma.testAttempt.count({ where: { status: "COMPLETED" } }).catch(() => 0),
    prisma.testAttempt.count({ where: { status: "COMPLETED", passed: true } }).catch(() => 0),
    prisma.certificate.count().catch(() => 0),
    prisma.certificate.count({ where: { revoked: true } }).catch(() => 0),
    prisma.user.findMany({ select: { createdAt: true }, take: 20000 }),
    prisma.aiRun.findMany({ where: { createdAt: { gte: d84 } }, select: { createdAt: true }, take: 20000 }).catch(() => [] as any[]),
    prisma.application.findMany({ where: { appliedAt: { gte: d84 } }, select: { appliedAt: true }, take: 20000 }).catch(() => [] as any[]),
  ])

  const mrrProxy = (planGroups as any[]).reduce((sum, g) => sum + (g._count?._all || 0) * planPrice(g.plan), 0)

  // ---- domain metric specs (null when the data is absent / too thin) ----
  const recruitment: MetricSpec[] = [
    { key: "role_freshness", label: "Role-catalogue freshness", unit: "%", value: pct(jobFresh90d, jobActive), good: 70, bad: 20, hint: "share of open roles posted in the last 90 days" },
    { key: "apps_per_opening", label: "Applications per opening", value: jobActive && appCount ? +(appCount / jobActive).toFixed(1) : null, good: 15, bad: 1, hint: "candidate demand per active role" },
    { key: "offer_acceptance", label: "Offer acceptance (proxy)", unit: "%", value: offeredCount ? pct(hiredCount, offeredCount) : null, good: 80, bad: 40 },
    { key: "app_to_interview", label: "Application → interview", unit: "%", value: appCount ? pct(interviewToApp, appCount) : null, good: 25, bad: 5 },
  ]
  const ai: MetricSpec[] = [
    { key: "ai_success", label: "AI execution success", unit: "%", value: ai7d ? pct(aiOk7d, ai7d) : (aiTotal ? 100 : null), good: 98, bad: 80, weight: 2, hint: "ok runs / total, last 7 days" },
    { key: "ai_adoption", label: "AI adoption", unit: "%", value: userCount ? pct(aiSubjects, userCount) : null, good: 30, bad: 3, hint: "distinct people who invoked an AI capability" },
    { key: "ai_confidence", label: "Mean inference confidence", unit: "%", value: (aiConf as any)?._avg?.confidence != null ? Math.round((aiConf as any)._avg.confidence * 100) : null, good: 80, bad: 40 },
    { key: "rec_reach", label: "Recommendation reach", unit: "%", value: recCount ? pct(recSubjects, userCount) : null, good: 40, bad: 5 },
  ]
  const financial: MetricSpec[] = [
    { key: "conversion", label: "Paid conversion", unit: "%", value: userCount ? pct(paidCount, userCount) : null, good: 8, bad: 1, weight: 2 },
  ]
  const security: MetricSpec[] = [
    { key: "twofa", label: "2FA adoption", unit: "%", value: userCount ? pct(twoFACount, userCount) : null, good: 50, bad: 5 },
    { key: "passkey", label: "Passkey adoption", unit: "%", value: userCount ? pct(passkeyUsers, userCount) : null, good: 30, bad: 2 },
    { key: "id_verified", label: "Identity verification", unit: "%", value: userCount ? pct(idVerCount, userCount) : null, good: 60, bad: 10 },
    { key: "banned", label: "Banned-account rate", unit: "%", value: userCount ? pct(bannedCount, userCount) : null, good: 0, bad: 5, higherIsBetter: false },
  ]
  const learning: MetricSpec[] = [
    { key: "assess_pass", label: "Assessment pass rate", unit: "%", value: testCompleted >= 3 ? pct(testPassed, testCompleted) : null, good: 70, bad: 30 },
    { key: "cert_integrity", label: "Certificate integrity", unit: "%", value: certTotal ? pct(certTotal - certRevoked, certTotal) : null, good: 98, bad: 85, hint: "non-revoked certificates" },
  ]
  const knowledge: MetricSpec[] = [
    { key: "knowledge_growth", label: "Knowledge growth (30d)", unit: "count", value: (semDocs + memEntries) ? (sem30d + mem30d) : null, good: 50, bad: 0, hint: "new indexed docs + memory entries" },
  ]
  const workforce: MetricSpec[] = [
    { key: "internship_completion", label: "Internship completion", unit: "%", value: null, good: 80, bad: 40 },
    { key: "task_completion", label: "Task completion", unit: "%", value: null, good: 80, bad: 40 },
    { key: "ppo_acceptance", label: "PPO acceptance", unit: "%", value: null, good: 70, bad: 30 },
  ]
  const community: MetricSpec[] = [
    { key: "connection_acceptance", label: "Connection acceptance", unit: "%", value: null, good: 60, bad: 20 },
    { key: "feed_engagement", label: "Feed engagement", unit: "%", value: null, good: 40, bad: 5 },
  ]

  const domains: DomainHealth[] = [
    scoreDomain("recruitment", "Recruitment", recruitment),
    scoreDomain("ai", "AI & Automation", ai),
    scoreDomain("financial", "Financial", financial),
    scoreDomain("security", "Identity & Security", security),
    scoreDomain("learning", "Learning", learning),
    scoreDomain("knowledge", "Knowledge", knowledge),
    scoreDomain("workforce", "Workforce", workforce),
    scoreDomain("community", "Community", community),
  ]
  const org = rollupHealth(domains, { ai: 1.5, financial: 1.5, security: 1.2, recruitment: 1.2 })

  const seriesOut: SeriesOut[] = [
    series("growth.newUsers", "New members / week", (userTs as any[]).map(u => +new Date(u.createdAt)), now),
    series("ai.runs", "AI runs / week", (aiTs as any[]).map(r => +new Date(r.createdAt)), now),
    series("recruitment.applications", "Applications / week", (appTs as any[]).map(a => +new Date(a.appliedAt)), now),
  ]

  // Decision support: generic rules + dark-domain coverage rule, over the health +
  // forecast context.
  const forecasts: Record<string, Forecast> = {}
  for (const s of seriesOut) forecasts[s.key] = s.forecast
  const decisions = runDecisions({ domains, forecasts }, [...GENERIC_RULES, darkDomainRule])

  const measuredDomains = domains.filter(d => d.score != null).length
  return {
    org,
    stats: {
      users: userCount, newUsers30d, paidUsers: paidCount, mrrProxyCHF: mrrProxy,
      activeRoles: jobActive, applications: appCount, aiRuns: aiTotal, aiRuns7d: ai7d,
      knowledgeItems: semDocs + memEntries, certificates: certTotal, companies: null,
    },
    series: seriesOut,
    decisions,
    generatedAt: new Date(now).toISOString(),
    coverageNote: `${measuredDomains}/${domains.length} domains measured (${Math.round(org.coverage * 100)}% metric coverage). Empty domains light up automatically as their data flows.`,
  }
}
