// Import the full EduRankAI careers catalog (437 real roles, pulled live from the
// EduRankAI Neon DB into prisma/data/edurankai-roles.json) into Vrittih as jobs,
// listed under the product/brand each role belongs to. Product-named departments
// map to their product; the cross-product org roles list under the parent brand
// "EduRankAI". Each brand becomes an employer + a Company page.
// Re-runnable: clears prior import (employers tagged source="edurankai") first.
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const p = new PrismaClient()
const __dir = dirname(fileURLToPath(import.meta.url))
const roles = JSON.parse(readFileSync(join(__dir, "data", "edurankai-roles.json"), "utf8"))

function slugify(name) {
  return (name || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/·/g, " ").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "company"
}

// Which brand a role belongs to. Only departments that clearly name a product map
// to it; everything else is a shared org role under the parent EduRankAI brand.
function brandFor(dept) {
  const d = (dept || "").toLowerCase()
  if (d.includes("viśvambhara") || d.includes("visvambhara") || d.includes("aerospace")) return "Viśvambhara"
  if (d.includes("aquintutor")) return "AquinTutor.ai"
  if (d.includes("hei")) return "HEI"
  if (d.includes("martial")) return "Karate.support"
  return "EduRankAI"
}

// Vrittih job type from EduRankAI engagement.
function jobType(engagement) {
  const e = (engagement || "").toLowerCase()
  if (e.includes("intern")) return "INTERNSHIP"
  if (e.includes("apprentice")) return "INTERNSHIP"
  if (e.includes("part")) return "PARTTIME"
  if (e.includes("consult") || e.includes("contract")) return "CONTRACT"
  return "FULLTIME"
}

// Closest Vrittih industry for the board filters.
function industryFor(dept) {
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

const BRAND_META = {
  "EduRankAI": { tagline: "AI for education, research and public good", industry: "Technology", hq: "Guwahati, India", about: "EduRankAI builds AI-native products across education, research integrity, and public good — from foundational models to student tools. We hire people who want to own real outcomes and do work that matters, across engineering, research, safety, design and operations." },
  "AquinTutor.ai": { tagline: "The AI tutor that teaches, not just answers", industry: "Education", hq: "Remote", about: "AquinTutor.ai is EduRankAI's flagship AI tutor — pedagogy-first, built to teach reasoning rather than hand out answers. Join us to shape how millions learn." },
  "Viśvambhara": { tagline: "Aerospace & deep-tech for the next frontier", industry: "Manufacturing", hq: "Guwahati, India", about: "Viśvambhara is EduRankAI's aerospace and deep-tech initiative, taking on hard problems in flight, materials and systems engineering." },
  "HEI": { tagline: "Truth reporting for higher-education integrity", industry: "Government", hq: "Remote", about: "HEI (Higher Education Integrity) builds the truth-reporting infrastructure that holds institutions accountable — data pipelines, evidence, and public findings." },
  "Karate.support": { tagline: "Technology for the global martial-arts community", industry: "Other", hq: "Remote", about: "Karate.support builds tools for the worldwide martial-arts community — federations, dojos, athletes and events." },
}

// ---- clear prior import ----
const prev = await p.user.findMany({ where: { source: "edurankai" }, select: { id: true } })
const prevIds = prev.map((u) => u.id)
if (prevIds.length) {
  await p.application.deleteMany({ where: { job: { postedById: { in: prevIds } } } })
  await p.job.deleteMany({ where: { postedById: { in: prevIds } } })
  await p.company.deleteMany({ where: { ownerId: { in: prevIds } } })
  await p.user.deleteMany({ where: { id: { in: prevIds } } })
}
console.log(`cleared ${prevIds.length} prior EduRankAI brand employers`)

const hash = await bcrypt.hash("EduRankAI@2026!", 10)

// ---- brand employers + company pages ----
const brandUser = {}
const brands = [...new Set(roles.map((r) => brandFor(r.department_name)))]
for (const brand of brands) {
  const meta = BRAND_META[brand] || { tagline: "Hiring now", industry: "Technology", hq: "Remote", about: `${brand} is hiring.` }
  const email = `careers+${slugify(brand)}@edurankai.in`
  const u = await p.user.create({
    data: { name: brand, email, password: hash, role: "EMPLOYER", paid: true, paidAt: new Date(), idVerified: true, source: "edurankai",
      headline: meta.tagline, location: meta.hq, profile: { create: {} } },
    select: { id: true },
  })
  brandUser[brand] = u.id
  const slug = slugify(brand)
  await p.company.upsert({
    where: { slug },
    update: { ownerId: u.id, verified: true, tagline: meta.tagline, industry: meta.industry, headquarters: meta.hq, about: meta.about },
    create: { slug, name: brand, ownerId: u.id, verified: true, tagline: meta.tagline, industry: meta.industry, headquarters: meta.hq, about: meta.about, size: "51-200" },
  })
}
console.log(`created ${brands.length} brands: ${brands.join(", ")}`)

// ---- jobs ----
function description(r) {
  const parts = []
  if (r.about) parts.push(r.about.trim())
  if (r.function) parts.push(`\nRole focus: ${r.function}`)
  const list = (label, arr) => { if (Array.isArray(arr) && arr.length) parts.push(`\n${label}:\n` + arr.map((x) => `• ${x}`).join("\n")) }
  list("What you'll do", r.responsibilities)
  list("What you'll bring", r.skills)
  list("Who should apply", r.eligibility)
  if (r.duration) parts.push(`\nDuration: ${r.duration}`)
  if (r.level) parts.push(`Level: ${r.level}`)
  parts.push(`\nTeam: ${r.department_name || "EduRankAI"}`)
  return parts.join("\n")
}

let created = 0, batch = []
async function flush() { if (batch.length) { await p.job.createMany({ data: batch }); created += batch.length; batch = [] } }
for (const r of roles) {
  const brand = brandFor(r.department_name)
  batch.push({
    title: r.title, company: brand, industry: industryFor(r.department_name),
    location: (r.location || "Remote").slice(0, 100),
    type: jobType(r.engagement_type),
    salary: r.salary ? String(r.salary).slice(0, 120) : null,
    remote: /remote|virtual|global|worldwide/i.test(r.location || ""),
    description: description(r), active: true, views: 0, postedById: brandUser[brand],
  })
  if (batch.length >= 500) await flush()
}
await flush()

// per-brand summary
const summary = {}
for (const r of roles) { const b = brandFor(r.department_name); summary[b] = (summary[b] || 0) + 1 }
console.log(`\n✅ Imported ${created} EduRankAI roles as jobs:`)
console.log(Object.entries(summary).sort((a, b) => b[1] - a[1]).map(([b, n]) => `   ${String(n).padStart(3)}  ${b}`).join("\n"))
console.log(`\nTotal jobs on board now: ${(await p.job.count()).toLocaleString()}`)
await p.$disconnect()
