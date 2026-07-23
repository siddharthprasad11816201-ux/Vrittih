// Publish the Sambandh hiring catalog as fully-detailed postings.
//
// Roles were derived from the company's own org blueprint (Volumes 19-24) by
// department hiring leads and then adversarially reviewed; 79 were cut as padding
// or duplicates. Titles are distinct roles, not one per head — headcount in the
// blueprint indicates team size, and posting 24 near-identical ads for one team
// would bury every other employer on the board.
//
// Posted natively: candidates apply on Vrittih and it reaches the Sambandh
// hiring team, tracked live. No external apply links.
//
//   node prisma/seed-sambandh.mjs           # publish
//   node prisma/seed-sambandh.mjs --draft   # import unpublished
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { SAMBANDH } from "./data/sambandh-roles.mjs"

const p = new PrismaClient()
const DRAFT = process.argv.includes("--draft")
const SOURCE_KEY = "sambandh-catalog"
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)

const COMPANY = {
  name: "Sambandh",
  slug: "sambandh",
  tagline: "India's verified, honesty-first dating",
  industry: "Technology",
  hq: "India",
  website: "https://www.sambandh.online",
  about: "Sambandh is verified, honesty-first dating for India. Every member is face-verified, and the AI Lakshan Book supports honesty and compatibility rather than vanity metrics. We are building the organisation out across engineering, operations, international expansion, communications and sustainability — handling sensitive personal data and real safety responsibility, which is why we hire people who take both seriously.",
}

function seniority(title) {
  if (/^(Chief|Founder)/i.test(title)) return "exec"
  if (/^(VP|Vice President|Head of)\b/i.test(title)) return "vp"
  if (/^(Director|Principal)\b/i.test(title)) return "director"
  if (/\b(Senior|Lead|Manager|Architect)\b/i.test(title)) return "senior"
  return "mid"
}
const EXPERIENCE = {
  exec: "Officer-level experience owning this function, with direct accountability to a board or founder.",
  vp: "Extensive experience leading this function at scale, including hiring and developing managers.",
  director: "Significant experience running teams and delivery in this area, accountable for outcomes.",
  senior: "Solid hands-on experience in this discipline that you can walk us through in detail.",
  mid: "Relevant experience or clearly demonstrable capability — strong projects and non-traditional routes are genuinely considered.",
}

// Sambandh handles identity documents, face-verification media and safety reports.
// Every posting says so plainly rather than burying it.
const DATA_NOTE = "A note on what this work involves: Sambandh face-verifies its members, so the company holds identity documents, verification media and safety reports. Depending on the role you may work near that data or with the people who do. We expect everyone here to treat it as what it is — information that can harm someone if it is mishandled — and we train, audit and restrict access accordingly."

function buildDescription({ title, purpose, team, teamContext, department, reportsTo, context, skills }) {
  const parts = []
  parts.push(`${COMPANY.name} — ${COMPANY.tagline}\n\n${COMPANY.about}`)
  parts.push(`\n${department}\n${context}`)
  if (teamContext) parts.push(`\n${team}\n${teamContext}`)
  parts.push(`\nAbout the role\n${purpose}`)
  // Do not restate the purpose here — "About the role" already says it, and
  // repeating it verbatim made the first bullet a duplicate of the paragraph above.
  parts.push(`\nWhat you'll do\n` + [
    `Own the outcome described above end to end, not just the parts that are easy to measure.`,
    `Work across ${team.toLowerCase()} and the teams it depends on — nothing here is delivered by one function alone.`,
    `Set and report the measures that show whether this is working, and say so plainly when it is not.`,
    `Handle member and company data according to policy, and raise it when a process would put that data at risk.`,
  ].map(x => `• ${x}`).join("\n"))
  parts.push(`\nWhat you'll bring\n` + skills.map(x => `• ${x}`).join("\n") + `\n• ${EXPERIENCE[seniority(title)]}`)
  parts.push(`\nWho should apply\n` + [
    `People who want ownership of a real outcome rather than a job description.`,
    `Candidates from any background — we care what you can do and how you think.`,
    `Applicants comfortable working from India or remotely as agreed; specifics are settled at offer stage.`,
  ].map(x => `• ${x}`).join("\n"))
  parts.push(`\n${DATA_NOTE}`)
  parts.push(`\nStructure\nTeam: ${team}\nDepartment: ${department}\nReports into: ${reportsTo}\nOrganisation: ${COMPANY.name} — ${COMPANY.tagline}\nWebsite: ${COMPANY.website}`)
  parts.push(`\nHow to apply\nApply directly on Vrittih. Your application reaches the ${COMPANY.name} hiring team and you can follow it live through every stage — we would rather tell you "no" quickly than leave you waiting.`)
  return parts.join("\n")
}

// ---- employer + company page ----
let owner = await p.user.findFirst({ where: { name: COMPANY.name, role: "EMPLOYER" }, select: { id: true } })
if (!owner) {
  owner = await p.user.create({
    data: {
      name: COMPANY.name, email: `careers@${COMPANY.slug}.vrittih.online`,
      password: await bcrypt.hash("Sambandh@2026!", 10),
      role: "EMPLOYER", paid: true, paidAt: new Date(), idVerified: true, source: "edurankai",
      headline: COMPANY.tagline, location: COMPANY.hq, profile: { create: {} },
    }, select: { id: true },
  })
}
await p.company.upsert({
  where: { slug: COMPANY.slug },
  update: { ownerId: owner.id, verified: true, tagline: COMPANY.tagline, industry: COMPANY.industry, headquarters: COMPANY.hq, about: COMPANY.about, website: COMPANY.website },
  create: { slug: COMPANY.slug, name: COMPANY.name, ownerId: owner.id, verified: true, tagline: COMPANY.tagline, industry: COMPANY.industry, headquarters: COMPANY.hq, about: COMPANY.about, website: COMPANY.website, size: "201-500" },
})

const prior = await p.job.deleteMany({ where: { company: COMPANY.name, sourceKey: SOURCE_KEY } })
if (prior.count) console.log(`cleared ${prior.count} previously imported roles`)

// ---- postings ----
let batch = [], created = 0, skipped = 0
const seen = new Set()
const flush = async () => { if (batch.length) { await p.job.createMany({ data: batch }); created += batch.length; batch = [] } }
const byDept = {}

for (const dept of SAMBANDH) {
  for (const team of dept.teams) {
    for (const role of team.roles) {
      const key = role.title.toLowerCase()
      if (seen.has(key)) { skipped++; continue }   // same title can recur across teams
      seen.add(key)
      batch.push({
        title: role.title,
        company: COMPANY.name,
        industry: COMPANY.industry,
        location: COMPANY.hq,
        type: "FULLTIME",
        salary: null,
        remote: false,
        description: buildDescription({
          title: role.title, purpose: role.purpose, team: team.team, teamContext: team.teamContext,
          department: dept.department, reportsTo: dept.reportsTo, context: dept.context, skills: dept.skills,
        }),
        active: !DRAFT,
        views: 0,
        postedById: owner.id,
        sourceKey: SOURCE_KEY,
        externalId: slugify(role.title),
      })
      byDept[dept.department] = (byDept[dept.department] || 0) + 1
      if (batch.length >= 300) await flush()
    }
  }
}
await flush()

console.log(`\n✅ Published ${created} ${COMPANY.name} roles${DRAFT ? " (as DRAFTS)" : ""}${skipped ? `, ${skipped} duplicate titles skipped` : ""}:`)
for (const [d, n] of Object.entries(byDept).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${d}`)
console.log(`\n   Board total: ${await p.job.count()}`)
await p.$disconnect()
