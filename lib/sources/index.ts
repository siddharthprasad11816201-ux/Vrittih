import type { SourceAdapter } from "@/lib/sources/types"
import { selfTestAdapter } from "@/lib/sources/selftest"

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
