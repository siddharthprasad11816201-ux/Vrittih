import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { resolveCandidate, type IntakeIdentity } from "@/lib/candidate/resolve"
import { rateLimit } from "@/lib/ratelimit/store"
import { logAction } from "@/lib/admin"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

const SOURCES = ["edurankai", "linkedin", "indeed", "aicte", "referral", "csv", "api", "manual", "career_fair", "email", "job_board"]
const KINDS = ["email", "phone", "linkedin", "github", "national_id", "external"]
const MAX_BATCH = 200

/**
 * Multi-source candidate intake (§52). EVERY source funnels through here so the platform
 * never accumulates one record per source for the same person.
 *
 * Only employers/admins may push candidates; this creates records about real people, so it
 * is not an open endpoint.
 */
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(payload.role)) {
    return NextResponse.json({ error: "Only employers can import candidates." }, { status: 403 })
  }
  const rl = await rateLimit("write", payload.userId, { scope: "intake" })
  if (!rl.allowed) return NextResponse.json({ error: "Too many imports. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }

  const list: any[] = Array.isArray(body?.candidates) ? body.candidates : [body]
  if (!list.length) return NextResponse.json({ error: "No candidates provided." }, { status: 400 })
  // Bounded: an unbounded batch would hold a connection open indefinitely.
  if (list.length > MAX_BATCH) {
    return NextResponse.json({ error: `Send at most ${MAX_BATCH} candidates per request (received ${list.length}).` }, { status: 413 })
  }

  const results: any[] = []
  const errors: any[] = []
  let created = 0, matched = 0, needsReview = 0

  for (const [i, raw] of list.entries()) {
    try {
      const source = String(raw?.source || body?.source || "manual").toLowerCase()
      if (!SOURCES.includes(source)) { errors.push({ index: i, error: `Unknown source "${source}".` }); continue }
      const name = String(raw?.name || "").trim()
      if (!name) { errors.push({ index: i, error: "name is required." }); continue }

      const identities: IntakeIdentity[] = []
      for (const idn of Array.isArray(raw?.identities) ? raw.identities : []) {
        if (!KINDS.includes(String(idn?.kind))) continue
        if (!idn?.value) continue
        identities.push({ kind: idn.kind, value: String(idn.value), verified: !!idn.verified })
      }
      // Convenience shorthands used by CSV/board imports.
      if (raw?.email) identities.push({ kind: "email", value: String(raw.email), verified: !!raw.emailVerified })
      if (raw?.phone) identities.push({ kind: "phone", value: String(raw.phone) })
      if (raw?.linkedin) identities.push({ kind: "linkedin", value: String(raw.linkedin) })

      if (!identities.length) {
        // Without any identifier we cannot deduplicate, and creating a name-only record
        // would guarantee duplicates later. Refuse rather than pollute the master.
        errors.push({ index: i, error: "At least one identifier (email, phone or LinkedIn) is required to deduplicate." })
        continue
      }

      const res = await resolveCandidate({
        name, identities,
        location: raw?.location ?? null,
        currentEmployer: raw?.currentEmployer ?? null,
        headline: raw?.headline ?? null,
        source,
        campaign: raw?.campaign ?? body?.campaign ?? null,
        externalId: raw?.externalId ?? null,
        referrerId: raw?.referrerId ?? null,
        tracking: raw?.tracking ?? null,
      })
      if (res.created) created++
      if (res.matched) matched++
      if (res.review.length) needsReview++
      results.push({
        index: i, candidateId: res.candidateId, created: res.created, matched: res.matched,
        // Ambiguous pairs are surfaced, never silently merged.
        review: res.review.map((r) => ({ candidateId: r.candidateId, confidence: r.match.confidence, reason: r.match.reviewReason, evidence: r.match.evidence })),
      })
    } catch (e: any) {
      errors.push({ index: i, error: String(e?.message || e) })
    }
  }

  await logAction(payload.userId, "candidate.intake", { count: list.length, created, matched, errors: errors.length }, req)
  return NextResponse.json({
    ok: errors.length === 0,
    summary: { received: list.length, created, matched, needsReview, failed: errors.length },
    results, errors,
  }, { status: errors.length && !results.length ? 400 : 200 })
}

/** Look up a candidate with their full, preserved source attribution. */
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const id = new URL(req.url).searchParams.get("id") || ""
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const c = await (prisma as any).candidate.findUnique({
    where: { id },
    include: {
      identities: { select: { kind: true, value: true, verified: true } },
      sources: { orderBy: { firstSeenAt: "asc" } },
      applications: { select: { id: true, jobId: true, status: true, appliedAt: true, source: true } },
    },
  })
  if (!c) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
  return NextResponse.json({
    candidate: {
      id: c.id, displayName: c.displayName, primaryEmail: c.primaryEmail, location: c.location,
      currentEmployer: c.currentEmployer, headline: c.headline, mergedIntoId: c.mergedIntoId,
      identities: c.identities,
      // Every channel this person ever arrived from, preserved across merges.
      sources: c.sources,
      applications: c.applications,
    },
  })
}
