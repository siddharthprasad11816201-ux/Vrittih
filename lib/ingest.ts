import { prisma } from "@/lib/prisma"
import { safeExternalUrl } from "@/lib/url"
import { slugify } from "@/lib/company"
import { randomBytes } from "crypto"
import type { SourceAdapter, NormalisedListing } from "@/lib/sources/types"

// Ingestion engine for aggregated listings (government portals, partner feeds).
//
// Rules that keep the board honest:
//  - We never invent an apply link. A listing without a valid official URL is skipped.
//  - Dedupe on (sourceKey, externalId), so re-running updates instead of duplicating.
//  - Listings that vanish from the source, or whose deadline has passed, are
//    deactivated — a closed notice must never look open. That's the whole point.
//  - A fetch error changes nothing; we record it rather than wiping live jobs.

const TYPES = ["FULLTIME", "PARTTIME", "INTERNSHIP", "CONTRACT", "FREELANCE"]
function normType(t?: string) {
  const s = (t || "").toUpperCase().replace(/[^A-Z]/g, "")
  return TYPES.includes(s) ? s : "FULLTIME"
}

/** Each source posts under its own employer account, so listings attribute correctly. */
async function employerFor(a: SourceAdapter): Promise<string> {
  const email = `source+${slugify(a.key)}@vrittih.online`
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return existing.id
  const bcrypt = await import("bcryptjs")
  const u = await prisma.user.create({
    data: {
      name: a.name, email,
      password: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
      role: "EMPLOYER", paid: true, paidAt: new Date(), idVerified: true,
      source: "ingest", headline: `${a.region || "India"} · Official listings`,
      profile: { create: {} },
    },
    select: { id: true },
  })
  return u.id
}

export type IngestReport = { source: string; found: number; created: number; updated: number; closed: number; skipped: number; error?: string }

export async function ingestSource(adapter: SourceAdapter): Promise<IngestReport> {
  const report: IngestReport = { source: adapter.key, found: 0, created: 0, updated: 0, closed: 0, skipped: 0 }

  await prisma.jobSource.upsert({
    where: { key: adapter.key },
    update: { name: adapter.name, homepage: adapter.homepage, kind: adapter.kind || "government", region: adapter.region },
    create: { key: adapter.key, name: adapter.name, homepage: adapter.homepage, kind: adapter.kind || "government", region: adapter.region },
  })

  let result
  try {
    result = await adapter.fetch()
  } catch (e: any) {
    result = { listings: [], error: e?.message || "fetch threw" }
  }

  if (result.error) {
    report.error = result.error
    await prisma.jobSource.update({
      where: { key: adapter.key },
      data: { lastRunAt: new Date(), lastOk: false, lastMessage: result.error.slice(0, 300) },
    })
    return report // a broken fetch must not deactivate real jobs
  }

  const employerId = await employerFor(adapter)
  report.found = result.listings.length
  const seen = new Set<string>()
  const now = new Date()

  for (const l of result.listings) {
    // An aggregated employer has no account here, so we cannot receive their
    // applications. A listing we can't link back to would strand the candidate —
    // skip it rather than publish a dead end.
    const govUrl = safeExternalUrl(l.govUrl)
    const applyUrl = safeExternalUrl(l.applyUrl)
    if (!l.externalId || !l.title || !(govUrl || applyUrl)) { report.skipped++; continue }
    seen.add(l.externalId)

    const closed = !!(l.closesAt && l.closesAt.getTime() < now.getTime())
    const data = {
      title: String(l.title).slice(0, 200),
      description: String(l.description || l.title),
      company: l.govBody,
      govBody: l.govBody,
      industry: l.industry || "Government",
      location: l.location || "India",
      type: normType(l.type),
      salary: l.salary ? String(l.salary).slice(0, 120) : null,
      remote: !!l.remote,
      govUrl,
      applyUrl,
      closesAt: l.closesAt ?? null,
      active: !closed,
      postedById: employerId,
    }

    const existing = await prisma.job.findUnique({
      where: { sourceKey_externalId: { sourceKey: adapter.key, externalId: l.externalId } },
      select: { id: true },
    })
    if (existing) { await prisma.job.update({ where: { id: existing.id }, data }); report.updated++ }
    else { await prisma.job.create({ data: { ...data, sourceKey: adapter.key, externalId: l.externalId } }); report.created++ }
  }

  // Anything we previously imported that the source no longer publishes, or whose
  // deadline has passed, is closed. Never leave a dead notice looking live.
  const stale = await prisma.job.findMany({
    where: { sourceKey: adapter.key, active: true, externalId: { notIn: [...seen] } },
    select: { id: true },
  })
  if (stale.length) {
    await prisma.job.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { active: false } })
    report.closed += stale.length
  }
  const expired = await prisma.job.updateMany({
    where: { sourceKey: adapter.key, active: true, closesAt: { lt: now } },
    data: { active: false },
  })
  report.closed += expired.count

  await prisma.jobSource.update({
    where: { key: adapter.key },
    data: {
      lastRunAt: new Date(), lastOk: true,
      lastMessage: `${report.created} new, ${report.updated} updated, ${report.closed} closed`,
      found: report.found, imported: report.created + report.updated,
    },
  })
  return report
}

/** Close any aggregated listing whose deadline has passed, across all sources. */
export async function expireClosed(): Promise<number> {
  const r = await prisma.job.updateMany({
    where: { active: true, closesAt: { lt: new Date() } },
    data: { active: false },
  })
  return r.count
}
