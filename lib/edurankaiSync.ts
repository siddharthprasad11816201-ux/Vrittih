import { prisma } from "@/lib/prisma"

/* Ongoing sync of the EduRankAI careers catalogue into Vrittih.
 *
 * Idempotent and in-place: every role is upserted by (sourceKey, externalId) =
 * ("edurankai-careers", slug), so a job keeps its Vrittih id across syncs — which
 * keeps its /jobs/<id> URL stable for SEO. A role that is no longer open is
 * deactivated (active=false), never deleted, so applications and indexed history
 * survive. Only careers-catalogue jobs are touched; the generated Viśvambhara /
 * Sambandh / Archery catalogues are left alone.
 *
 * Source: EDURANKAI_DATABASE_URL (the EduRankAI Postgres). Read-only there. */

export const EDURANKAI_SOURCE_KEY = "edurankai-careers"

const slugify = (name: string) =>
  (name || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/·/g, " ").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "company"

function brandFor(dept: string) {
  const d = (dept || "").toLowerCase()
  if (d.includes("viśvambhara") || d.includes("visvambhara") || d.includes("aerospace")) return "Viśvambhara"
  if (d.includes("aquintutor")) return "AquinTutor.ai"
  if (d.includes("hei")) return "HEI"
  if (d.includes("martial")) return "Karate.support"
  return "EduRankAI"
}
function jobType(engagement: string) {
  const e = (engagement || "").toLowerCase()
  if (e.includes("intern") || e.includes("apprentice")) return "INTERNSHIP"
  if (e.includes("part")) return "PARTTIME"
  if (e.includes("consult") || e.includes("contract")) return "CONTRACT"
  return "FULLTIME"
}
function industryFor(dept: string) {
  const d = (dept || "").toLowerCase()
  if (/legal/.test(d)) return "Legal"
  if (/finance/.test(d)) return "Finance"
  if (/growth|marketing|sales|social|consumer|media/.test(d)) return "Media"
  if (/csr|impact|sustainab|outreach|partnership|government|policy|hei/.test(d)) return "Government"
  if (/aquintutor|research|psychology|innovation|education|training|academic/.test(d)) return "Education"
  if (/logistic|marketplace|supply/.test(d)) return "Logistics"
  if (/aerospace|hardware|manufactur/.test(d)) return "Manufacturing"
  return "Technology"
}
const BRAND_META: Record<string, { tagline: string; industry: string; hq: string; website?: string; about: string }> = {
  "EduRankAI": { tagline: "AI for education, research and public good", industry: "Technology", hq: "Guwahati, India", website: "https://www.edurankai.in", about: "EduRankAI builds AI-native products across education, research integrity, and public good — from foundational models to student tools." },
  "AquinTutor.ai": { tagline: "The AI tutor that teaches, not just answers", industry: "Education", hq: "Remote", about: "AquinTutor.ai is EduRankAI's flagship AI tutor — pedagogy-first, built to teach reasoning rather than hand out answers." },
  "Viśvambhara": { tagline: "Aerospace & deep-tech for the next frontier", industry: "Manufacturing", hq: "Guwahati, India", about: "Viśvambhara is EduRankAI's aerospace and deep-tech initiative, taking on hard problems in flight, materials and systems engineering." },
  "HEI": { tagline: "Truth reporting for higher-education integrity", industry: "Government", hq: "Remote", about: "HEI (Higher Education Integrity) builds the truth-reporting infrastructure that holds institutions accountable." },
  "Karate.support": { tagline: "Technology for the global martial-arts community", industry: "Other", hq: "Remote", about: "Karate.support builds tools for the worldwide martial-arts community — federations, dojos, athletes and events." },
}

function describe(r: any) {
  const parts: string[] = []
  if (r.about) parts.push(String(r.about).trim())
  if (r.function) parts.push(`\nRole focus: ${r.function}`)
  const list = (label: string, arr: any) => { if (Array.isArray(arr) && arr.length) parts.push(`\n${label}:\n` + arr.map((x: any) => `• ${x}`).join("\n")) }
  list("What you'll do", r.responsibilities)
  list("What you'll bring", r.skills)
  list("Who should apply", r.eligibility)
  if (r.duration) parts.push(`\nDuration: ${r.duration}`)
  if (r.level) parts.push(`Level: ${r.level}`)
  parts.push(`\nTeam: ${r.department_name || "EduRankAI"}`)
  return parts.join("\n")
}

type Row = {
  slug: string; title: string; level: string; function: string; engagement_type: string
  location: string; duration: string; salary: string; about: string
  responsibilities: string[]; skills: string[]; eligibility: string[]; department_name: string
}

async function pullRoles(sourceUrl: string): Promise<Row[]> {
  const pg = (await import("pg")).default
  const client = new pg.Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const { rows } = await client.query(`
      SELECT r.slug, r.title, r.level, r.function, r.engagement_type, r.location, r.duration,
             r.salary, r.about, r.responsibilities, r.skills, r.eligibility, d.name AS department_name
      FROM roles r LEFT JOIN departments d ON d.id = r.department_id
      WHERE r.is_open = true`)
    return rows as Row[]
  } finally {
    await client.end()
  }
}

async function ensureBrand(brand: string, cache: Map<string, string>): Promise<string> {
  if (cache.has(brand)) return cache.get(brand)!
  const meta = BRAND_META[brand] || { tagline: "Hiring now", industry: "Technology", hq: "Remote", about: `${brand} is hiring.` }
  const email = `careers+${slugify(brand)}@edurankai.in`
  let owner = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!owner) {
    const bcrypt = (await import("bcryptjs")).default
    owner = await prisma.user.create({
      data: { name: brand, email, password: await bcrypt.hash("EduRankAI@2026!", 10), role: "EMPLOYER", paid: true, paidAt: new Date(), idVerified: true, source: "edurankai", headline: meta.tagline, location: meta.hq, profile: { create: {} } },
      select: { id: true },
    })
  }
  await prisma.company.upsert({
    where: { slug: slugify(brand) },
    update: { ownerId: owner.id, verified: true, tagline: meta.tagline, industry: meta.industry, headquarters: meta.hq, about: meta.about, website: meta.website ?? null },
    create: { slug: slugify(brand), name: brand, ownerId: owner.id, verified: true, tagline: meta.tagline, industry: meta.industry, headquarters: meta.hq, about: meta.about, website: meta.website ?? null, size: "51-200" },
  })
  cache.set(brand, owner.id)
  return owner.id
}

// One-time: give the originally-seeded careers jobs a stable key so they update
// in place instead of being duplicated. Their applyUrl carries the slug.
async function backfillLegacyKeys() {
  const legacy = await prisma.job.findMany({
    where: { sourceKey: null, applyUrl: { contains: "/apply?role=" } },
    select: { id: true, applyUrl: true },
  })
  let tagged = 0
  for (const j of legacy) {
    const m = /[?&]role=([^&]+)/.exec(j.applyUrl || "")
    if (!m) continue
    const slug = decodeURIComponent(m[1])
    try {
      await prisma.job.update({ where: { id: j.id }, data: { sourceKey: EDURANKAI_SOURCE_KEY, externalId: slug } })
      tagged++
    } catch { /* a same-slug row already holds the key; leave this one */ }
  }
  return tagged
}

export async function syncEdurankai(sourceUrl: string) {
  const tagged = await backfillLegacyKeys()
  const roles = await pullRoles(sourceUrl)
  const brandCache = new Map<string, string>()
  const incoming = new Set<string>()
  let created = 0, updated = 0

  for (const r of roles) {
    if (!r.slug) continue
    incoming.add(r.slug)
    const brand = brandFor(r.department_name)
    const ownerId = await ensureBrand(brand, brandCache)
    const data = {
      title: r.title,
      company: brand,
      industry: industryFor(r.department_name),
      location: (r.location || "Remote").slice(0, 100),
      type: jobType(r.engagement_type),
      salary: r.salary ? String(r.salary).slice(0, 120) : null,
      remote: /remote|virtual|global|worldwide/i.test(r.location || ""),
      description: describe(r),
      applyUrl: `https://www.edurankai.in/apply?role=${encodeURIComponent(r.slug)}`,
      active: true,
      postedById: ownerId,
    }
    const res = await prisma.job.upsert({
      where: { sourceKey_externalId: { sourceKey: EDURANKAI_SOURCE_KEY, externalId: r.slug } },
      update: data,
      create: { ...data, sourceKey: EDURANKAI_SOURCE_KEY, externalId: r.slug, views: 0 },
      select: { createdAt: true, updatedAt: true },
    })
    if (res.createdAt.getTime() === res.updatedAt.getTime()) created++
    else updated++
  }

  // Anything we have under this source that is no longer open -> deactivate.
  const closed = await prisma.job.updateMany({
    where: { sourceKey: EDURANKAI_SOURCE_KEY, active: true, externalId: { notIn: [...incoming] } },
    data: { active: false },
  })

  return { pulled: roles.length, created, updated, closed: closed.count, taggedLegacy: tagged }
}
