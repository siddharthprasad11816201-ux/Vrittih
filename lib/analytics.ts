/**
 * Vrittih in-house analytics — a durable event stream in `AnalyticsEvent`.
 * `track()` never throws (analytics must not break a request path).
 */
import { prisma } from "@/lib/prisma"

export async function track(name: string, props: Record<string, unknown> = {}, userId?: string | null): Promise<void> {
  try {
    await prisma.analyticsEvent.create({ data: { name, userId: userId ?? null, props: JSON.stringify(props) } })
  } catch { /* swallow — analytics is best-effort */ }
}

/** Aggregate summary for dashboards. */
export async function summary(days = 30) {
  const since = new Date(Date.now() - days * 86400_000)
  const [byName, total, activeUsers, recent] = await Promise.all([
    prisma.analyticsEvent.groupBy({ by: ["name"], where: { createdAt: { gte: since } }, _count: true }),
    prisma.analyticsEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.analyticsEvent.findMany({ where: { createdAt: { gte: since }, userId: { not: null } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.analyticsEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { name: true, userId: true, createdAt: true } }),
  ])
  // events per day (last `days`)
  const perDayMap = new Map<string, number>()
  const rows = await prisma.analyticsEvent.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } })
  for (const r of rows) {
    const d = r.createdAt.toISOString().slice(0, 10)
    perDayMap.set(d, (perDayMap.get(d) || 0) + 1)
  }
  const perDay = [...perDayMap.entries()].sort().map(([date, count]) => ({ date, count }))

  return {
    total,
    activeUsers: activeUsers.length,
    byName: byName.map((r) => ({ name: r.name, count: r._count })).sort((a, b) => b.count - a.count),
    perDay,
    recent,
  }
}
