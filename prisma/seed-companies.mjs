// Backfill Company pages from the jobs already on the board. Every distinct
// company name that has listings gets a real profile: industry + HQ from its most
// common job values, a size band from its role count, generated about/tagline, and
// an owner linked to the matching employer user when one exists.
// Re-runnable: upserts by slug, so existing edits to known fields are preserved.
import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

function slugify(name) {
  return (name || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "company"
}
function sizeBand(n) {
  if (n >= 90) return "1000-5000"; if (n >= 60) return "501-1000"; if (n >= 35) return "201-500"
  if (n >= 15) return "51-200"; if (n >= 5) return "11-50"; return "1-10"
}
function about(name, industry, hq) {
  return `${name} is a ${(industry || "technology").toLowerCase()} company${hq ? ` headquartered in ${hq}` : ""}. We build products and services that matter to our customers, and we hire people who care about doing excellent work. Our teams value ownership, craft and clear communication — and we back that with real investment in learning and growth. Explore our open roles below and find where you fit.`
}
const mode = (arr) => { const m = {}; let best = arr[0], bc = 0; for (const v of arr) { m[v] = (m[v] || 0) + 1; if (m[v] > bc) { bc = m[v]; best = v } } return best }

// group jobs by company
const groups = await p.job.groupBy({ by: ["company"], _count: { _all: true } })
console.log(`found ${groups.length} distinct companies in jobs`)

// employer users by name -> possible owner
const employers = await p.user.findMany({ where: { role: { in: ["EMPLOYER", "ADMIN", "SUPER_ADMIN"] } }, select: { id: true, name: true } })
const ownerByName = new Map(employers.map((e) => [e.name, e.id]))

const usedSlugs = new Set((await p.company.findMany({ select: { slug: true } })).map((c) => c.slug))
let created = 0, updated = 0
for (const g of groups) {
  const name = g.company
  if (!name) continue
  const sample = await p.job.findMany({ where: { company: name }, select: { industry: true, location: true }, take: 200 })
  const industry = mode(sample.map((s) => s.industry).filter(Boolean)) || "Technology"
  const hq = mode(sample.map((s) => s.location).filter((l) => l && !/^remote/i.test(l))) || mode(sample.map((s) => s.location)) || ""
  const existing = await p.company.findFirst({ where: { name } })
  let slug = existing?.slug || slugify(name)
  if (!existing) { let base = slug, i = 2; while (usedSlugs.has(slug)) slug = `${base}-${i++}`; usedSlugs.add(slug) }

  const data = {
    name, industry, headquarters: hq, size: sizeBand(g._count._all),
    tagline: `${industry} · Hiring now`, about: about(name, industry, hq),
    ownerId: ownerByName.get(name) || null,
    verified: !!ownerByName.get(name),
  }
  if (existing) { await p.company.update({ where: { id: existing.id }, data: { industry: data.industry, headquarters: data.headquarters, size: data.size, ownerId: data.ownerId ?? existing.ownerId } }); updated++ }
  else { await p.company.create({ data: { slug, ...data } }); created++ }
}
console.log(`\n✅ Companies backfilled — created ${created}, updated ${updated}, total ${await p.company.count()}.`)
await p.$disconnect()
