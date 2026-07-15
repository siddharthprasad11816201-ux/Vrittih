import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { allSources, getSource } from "@/lib/sources"
import { ingestSource, expireClosed } from "@/lib/ingest"

export const dynamic = "force-dynamic"

// GET -> registered sources with health, so a silently broken scraper is visible
// rather than quietly serving stale notices.
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  const rows = await prisma.jobSource.findMany({ orderBy: { key: "asc" } })
  const live = await prisma.job.groupBy({ by: ["sourceKey"], where: { active: true, sourceKey: { not: null } }, _count: { _all: true } })
  const liveBy: Record<string, number> = {}
  for (const l of live) if (l.sourceKey) liveBy[l.sourceKey] = l._count._all

  return NextResponse.json({
    registered: allSources().map((a) => ({ key: a.key, name: a.name, homepage: a.homepage, region: a.region })),
    sources: rows.map((r) => ({
      key: r.key, name: r.name, homepage: r.homepage, kind: r.kind, region: r.region, active: r.active,
      lastRunAt: r.lastRunAt, lastOk: r.lastOk, lastMessage: r.lastMessage,
      found: r.found, imported: r.imported, liveJobs: liveBy[r.key] || 0,
    })),
  })
}

// POST { key } -> run one source. POST { expire: true } -> close past-deadline listings.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  const body = await req.json().catch(() => ({}))

  if (body.expire) return NextResponse.json({ ok: true, closed: await expireClosed() })

  const adapter = getSource(body.key)
  if (!adapter) return NextResponse.json({ error: `Unknown source "${body.key}". Registered: ${allSources().map((a) => a.key).join(", ") || "none"}` }, { status: 400 })

  const report = await ingestSource(adapter)
  return NextResponse.json({ ok: !report.error, report })
}
