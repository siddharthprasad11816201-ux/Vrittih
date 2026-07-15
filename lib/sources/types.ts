// Contract every ingestion source implements.
//
// Government portals all publish differently — HTML notice boards, JSON behind a
// SPA, PDF notifications. An adapter's only job is to turn one portal into
// NormalisedListings; lib/ingest.ts owns everything after that (dedupe, expiry,
// persistence), so adding a portal stays a small, isolated piece of work.

export type NormalisedListing = {
  /** The source's own stable id for this listing. Used to dedupe on re-runs. */
  externalId: string
  title: string
  /** The recruiting authority, e.g. "Staff Selection Commission". */
  govBody: string
  description: string
  location: string
  /** Official notice / apply page on the portal. Required — we never invent it. */
  govUrl: string
  /** Application deadline, if the notice states one. null when genuinely unknown. */
  closesAt?: Date | null
  type?: string
  salary?: string | null
  industry?: string
  remote?: boolean
  /** When the notice was published, if known. */
  postedAt?: Date | null
}

export type FetchResult = {
  listings: NormalisedListing[]
  /** Set when the adapter could not fetch — ingest records it and changes nothing. */
  error?: string
}

export type SourceAdapter = {
  key: string
  name: string
  homepage: string
  kind?: "government" | "private" | "partner"
  region?: string
  /** Fetch the currently-published listings. Must be side-effect free. */
  fetch: () => Promise<FetchResult>
}
