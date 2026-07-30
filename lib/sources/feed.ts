import type { SourceAdapter, NormalisedListing, FetchResult } from "@/lib/sources/types"

/* Generic jobs-feed adapter — the reusable way to connect ANY site without
 * touching its database. A site publishes its currently-open roles as JSON at a
 * public URL; Vrittih fetches that URL and ingest.ts does the rest (dedupe by
 * externalId, deactivate anything the feed no longer lists, expire past
 * deadlines, record health). Adding a site is then just a JobSource row with a
 * feedUrl — no code, no credentials.
 *
 * Feed contract (what the site returns):
 *   { "jobs": [ {
 *       "externalId": "stable-id",          // required — the site's own id/slug
 *       "title": "Senior Engineer",         // required
 *       "company": "Acme",                  // hiring org shown to candidates
 *       "description": "…",
 *       "applyUrl": "https://acme.com/…",   // required — where to actually apply
 *       "location": "Bengaluru, India",
 *       "type": "FULLTIME|PARTTIME|INTERNSHIP|CONTRACT|FREELANCE",
 *       "remote": false,
 *       "salary": "…",                      // optional, free text
 *       "industry": "Technology",           // optional
 *       "closesAt": "2026-09-01T00:00:00Z"  // optional ISO; omit if unknown
 *   } ] }
 * A jobs array at the top level is also accepted. Each listing MUST carry
 * applyUrl (or govUrl) — a listing we can't send the candidate back to is a dead
 * end, and ingest skips it. */

const MAX_BYTES = 8_000_000
const MAX_LISTINGS = 20_000

function toDate(v: any): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export function feedSource(cfg: {
  key: string
  name: string
  homepage: string
  feedUrl: string
  kind?: "government" | "private" | "partner"
  region?: string
}): SourceAdapter {
  return {
    key: cfg.key,
    name: cfg.name,
    homepage: cfg.homepage,
    kind: cfg.kind || "partner",
    region: cfg.region,
    async fetch(): Promise<FetchResult> {
      let res: Response
      try {
        res = await fetch(cfg.feedUrl, {
          headers: { accept: "application/json", "user-agent": "VrittihBot/1.0 (+https://www.vrittih.online)" },
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        })
      } catch (e: any) {
        return { listings: [], error: `feed fetch failed: ${e?.message || e}` }
      }
      if (!res.ok) return { listings: [], error: `feed returned HTTP ${res.status}` }

      const text = await res.text()
      if (text.length > MAX_BYTES) return { listings: [], error: `feed too large (${text.length} bytes)` }
      let body: any
      try { body = JSON.parse(text) } catch { return { listings: [], error: "feed is not valid JSON" } }

      const raw: any[] = Array.isArray(body) ? body : Array.isArray(body?.jobs) ? body.jobs : []
      if (!raw.length) return { listings: [], error: "feed contained no jobs" }

      const listings: NormalisedListing[] = []
      for (const j of raw.slice(0, MAX_LISTINGS)) {
        if (!j || !j.externalId || !j.title) continue
        listings.push({
          externalId: String(j.externalId).slice(0, 200),
          title: String(j.title),
          govBody: String(j.company || j.govBody || cfg.name),
          description: String(j.description || j.title),
          location: String(j.location || "Remote"),
          applyUrl: j.applyUrl || j.url || undefined,
          govUrl: j.govUrl || undefined,
          type: j.type,
          salary: j.salary != null ? String(j.salary) : null,
          industry: j.industry || undefined,
          remote: !!j.remote,
          closesAt: toDate(j.closesAt),
          postedAt: toDate(j.postedAt),
        })
      }
      return { listings }
    },
  }
}
