import type { SourceAdapter, NormalisedListing } from "@/lib/sources/types"

// A synthetic source that exercises every ingestion rule, so the engine can be
// verified without depending on a live government portal being up (or scraped).
// Registered only outside production — see lib/sources/index.ts.
//
// Drive it with env-free scenarios via the `scenario` module state:
//   normal  -> a mix of open, closing-soon, already-closed and link-less notices
//   removed -> the same minus one open notice (it must get closed)
//   broken  -> a fetch failure (must change nothing)
const DAY = 86400000

export let scenario: "normal" | "removed" | "broken" = "normal"
export function setScenario(s: typeof scenario) { scenario = s }

const at = (days: number) => new Date(Date.now() + days * DAY)
const base = (): NormalisedListing[] => [
  { externalId: "T-1", title: "Assistant Section Officer", govBody: "Test Commission", description: "Official recruitment notice for verification.", location: "New Delhi, India", govUrl: "https://ssc.nic.in/notice/1", closesAt: at(20) },
  { externalId: "T-2", title: "Junior Engineer (Civil)", govBody: "Test Commission", description: "Official recruitment notice for verification.", location: "Mumbai, India", govUrl: "https://ssc.nic.in/notice/2", closesAt: at(3) },
  { externalId: "T-3", title: "Already Closed Post", govBody: "Test Commission", description: "Official recruitment notice for verification.", location: "Chennai, India", govUrl: "https://ssc.nic.in/notice/3", closesAt: at(-2) },
  { externalId: "T-4", title: "No Official Link Post", govBody: "Test Commission", description: "Must be skipped — we never invent an apply link.", location: "India", govUrl: "" },
]

export const selfTestAdapter: SourceAdapter = {
  key: "__selftest",
  name: "Ingestion self-test",
  homepage: "https://example.invalid",
  region: "India",
  fetch: async () => {
    if (scenario === "broken") return { listings: [], error: "portal timed out" }
    const l = base()
    return { listings: scenario === "removed" ? l.filter((x) => x.externalId !== "T-1") : l }
  },
}
