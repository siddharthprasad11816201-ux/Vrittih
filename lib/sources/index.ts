import type { SourceAdapter } from "@/lib/sources/types"
import { selfTestAdapter } from "@/lib/sources/selftest"
import { feedSource } from "@/lib/sources/feed"
import { prisma } from "@/lib/prisma"

// Registry of ingestion adapters. Add a government portal by writing one adapter
// (see types.ts) and listing it here — lib/ingest.ts handles the rest.
//
// Deliberately empty of real portals for now: there is no public API for live
// Indian government vacancies (data.gov.in publishes only historical statistics,
// and NCS renders listings client-side), so each portal needs its own adapter
// built and checked against that portal's robots.txt and terms. Shipping a
// half-working scraper would put wrong or stale notices in front of applicants,
// which is worse than showing none.
const ADAPTERS: SourceAdapter[] = []

// A synthetic source used to verify the ingestion rules end-to-end. Never
// available in production, so it can't put fake jobs in front of real people.
if (process.env.NODE_ENV !== "production") ADAPTERS.push(selfTestAdapter)

export function allSources(): SourceAdapter[] {
  return ADAPTERS
}
export function getSource(key: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.key === key)
}

// Feed-based sources are stored in the DB (a JobSource row with a feedUrl), so a
// new site is connected without a code change. This builds a generic feed adapter
// for each active one and merges them with the code-defined adapters above.
export async function allSourcesAsync(): Promise<SourceAdapter[]> {
  let feeds: SourceAdapter[] = []
  try {
    const rows = await prisma.jobSource.findMany({ where: { active: true, feedUrl: { not: null } } })
    feeds = rows.map((r) =>
      feedSource({ key: r.key, name: r.name, homepage: r.homepage, feedUrl: r.feedUrl!, kind: r.kind as any, region: r.region || undefined }),
    )
  } catch { /* DB down -> just the code adapters */ }
  const codeKeys = new Set(ADAPTERS.map((a) => a.key))
  return [...ADAPTERS, ...feeds.filter((f) => !codeKeys.has(f.key))]
}

export async function getSourceAsync(key: string): Promise<SourceAdapter | undefined> {
  return (await allSourcesAsync()).find((a) => a.key === key)
}
