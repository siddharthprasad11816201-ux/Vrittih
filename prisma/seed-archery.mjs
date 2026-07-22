// Publish the Archery.Services hiring catalog (295 roles, 22 departments) as
// fully-detailed postings.
//
// Every role is posted NATIVELY: candidates apply on Vrittih and the application
// reaches the Archery.Services hiring team, tracked live through all seven stages.
// No external apply links — Vrittih is the hiring platform, not a redirector.
//
//   node prisma/seed-archery.mjs           # publish
//   node prisma/seed-archery.mjs --draft   # import unpublished (active=false)
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { COMPANY, DEPARTMENTS } from "./data/archery-catalog.mjs"
import { ARCHERY_DETAIL } from "./data/archery-detail.mjs"

const p = new PrismaClient()
const DRAFT = process.argv.includes("--draft")
const SOURCE_KEY = "archery-catalog" // dedupe tag only — NOT an external JobSource
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)

const detailFor = Object.fromEntries(ARCHERY_DETAIL.map((d) => [d.department, d]))
const advisoryDepts = new Set(DEPARTMENTS.filter((d) => d.advisory).map((d) => d.department))

// Seniority drives the "who should apply" line — a VP posting should not read
// like a graduate one.
function seniority(title) {
  if (/^(Founder|Chief|General Counsel)/i.test(title)) return "exec"
  if (/^VP\b/i.test(title)) return "vp"
  if (/^(Director|Head)\b/i.test(title)) return "director"
  if (/\b(Senior|Lead|Principal|Architect|Manager)\b/i.test(title)) return "senior"
  if (/\b(Associate|Executive|Intern|Coordinator|Analyst|Specialist)\b/i.test(title)) return "mid"
  return "mid"
}

const EXPERIENCE = {
  exec: "Substantial leadership experience owning this function, including budget and board- or investor-level reporting.",
  vp: "Extensive experience leading this function at scale, including hiring and developing managers.",
  director: "Significant experience running teams and delivery in this area, with accountability for outcomes.",
  senior: "Solid hands-on experience in this discipline, with a track record you can walk us through in detail.",
  mid: "Relevant experience or demonstrable capability — strong portfolios, projects and non-traditional routes are genuinely considered.",
}

function buildDescription({ title, purpose, department, context, skills, advisory }) {
  const parts = []
  parts.push(`${COMPANY.name} — ${COMPANY.tagline}\n\n${COMPANY.about}`)
  parts.push(`\n${department}\n${context}`)
  parts.push(`\nAbout the role\n${purpose}`)

  if (advisory) {
    parts.push(`\nThis is a non-employee advisory position — a part-time commitment (typically a few hours a month) advising the leadership team, not an operational role.`)
  }

  parts.push(`\nWhat you'll do\n` + [
    purpose.replace(/^You /, "Own this: you "),
    `Work directly with the teams this role depends on — engineering, product, sport and commercial do not operate in isolation here.`,
    advisory
      ? `Bring outside perspective and challenge assumptions, including when the answer is one we would rather not hear.`
      : `Set and report the measures that show whether this is working, and say so plainly when it is not.`,
    `Operate with the constraints of competitive archery in mind: World Archery and national federation rules are not negotiable, and event days do not move.`,
  ].map((x) => `• ${x}`).join("\n"))

  parts.push(`\nWhat you'll bring\n` + skills.map((x) => `• ${x}`).join("\n") +
    `\n• ${EXPERIENCE[seniority(title)]}`)

  parts.push(`\nWho should apply\n` + [
    `People who want ownership of a real outcome rather than a job description.`,
    `Candidates from outside sport are welcome — we will teach you archery; we cannot teach judgement.`,
    `Applicants from any location; the team works from India and remotely, and specifics are agreed at offer stage.`,
  ].map((x) => `• ${x}`).join("\n"))

  parts.push(`\nStructure\nDepartment: ${department}\nOrganisation: ${COMPANY.name} — ${COMPANY.tagline}\nWebsite: ${COMPANY.website}`)

  parts.push(`\nHow to apply\nApply directly on Vrittih. Your application goes to the ${COMPANY.name} hiring team and you can follow it live through every stage — we would rather tell you "no" quickly than leave you waiting.`)

  return parts.join("\n")
}

// ---- employer + company page ----
let owner = await p.user.findFirst({ where: { name: COMPANY.name, role: "EMPLOYER" }, select: { id: true } })
if (!owner) {
  owner = await p.user.create({
    data: {
      name: COMPANY.name, email: `careers@${COMPANY.slug}.vrittih.online`,
      password: await bcrypt.hash("Archery@2026!", 10),
      role: "EMPLOYER", paid: true, paidAt: new Date(), idVerified: true, source: "archery",
      headline: COMPANY.tagline, location: COMPANY.hq, profile: { create: {} },
    }, select: { id: true },
  })
}
await p.company.upsert({
  where: { slug: COMPANY.slug },
  update: { ownerId: owner.id, verified: true, tagline: COMPANY.tagline, industry: COMPANY.industry, headquarters: COMPANY.hq, about: COMPANY.about, website: COMPANY.website },
  create: { slug: COMPANY.slug, name: COMPANY.name, ownerId: owner.id, verified: true, tagline: COMPANY.tagline, industry: COMPANY.industry, headquarters: COMPANY.hq, about: COMPANY.about, website: COMPANY.website, size: "51-200" },
})

const prior = await p.job.deleteMany({ where: { company: COMPANY.name, sourceKey: SOURCE_KEY } })
if (prior.count) console.log(`cleared ${prior.count} previously imported roles`)

// ---- postings ----
let batch = [], created = 0
const flush = async () => { if (batch.length) { await p.job.createMany({ data: batch }); created += batch.length; batch = [] } }

const byDept = {}
for (const dept of DEPARTMENTS) {
  const detail = detailFor[dept.department]
  if (!detail) { console.log(`! no detail for ${dept.department} — skipped`); continue }
  const purposeOf = Object.fromEntries(detail.roles.map((r) => [r.title, r.purpose]))
  const advisory = advisoryDepts.has(dept.department)

  for (const title of dept.roles) {
    const purpose = purposeOf[title]
    if (!purpose) { console.log(`! no purpose for "${title}" — skipped`); continue }
    batch.push({
      title,
      company: COMPANY.name,
      industry: COMPANY.industry,
      location: COMPANY.hq,
      type: advisory ? "CONTRACT" : "FULLTIME",
      salary: null,
      remote: false,
      description: buildDescription({ title, purpose, department: dept.department, context: detail.context, skills: detail.skills, advisory }),
      active: !DRAFT,
      views: 0,
      postedById: owner.id,
      sourceKey: SOURCE_KEY,
      externalId: slugify(title),
    })
    byDept[dept.department] = (byDept[dept.department] || 0) + 1
    if (batch.length >= 300) await flush()
  }
}
await flush()

console.log(`\n✅ Published ${created} ${COMPANY.name} roles${DRAFT ? " (as DRAFTS)" : ""}:`)
for (const [d, n] of Object.entries(byDept).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${d}`)
console.log(`\n   Board total: ${await p.job.count()}`)
await p.$disconnect()
