// Market-scale job generator. A real portal isn't 91 listings — it's tens of
// thousands, across hundreds of companies, that you can search and filter
// instantly. This creates ~150 company employers and ~12,000 live jobs so the
// board, search index, filters and pagination all behave like production.
// Re-runnable: clears prior generated data (employers tagged source="scale").
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const p = new PrismaClient()
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const rint = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1))
const daysAgo = (n) => new Date(Date.now() - n * 86400000)

const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Education", "Manufacturing", "Retail", "Legal", "Logistics", "Energy", "Media", "Government", "Agriculture"]
const CO_PRE = ["Nimbus", "Vertex", "Aurora", "Northwind", "Helios", "Quantic", "Meridian", "Solstice", "Cobalt", "Lumen", "Orbit", "Cedar", "Atlas", "Pioneer", "Beacon", "Zenith", "Terra", "Nova", "Pulse", "Ember", "Ridge", "Sable", "Onyx", "Iris", "Delta", "Summit", "Harbor", "Vantage", "Cipher", "Verdant"]
const CO_SUF = ["Labs", "Systems", "Technologies", "Health", "Financial", "Capital", "Industries", "Logistics", "Energy", "Media", "Analytics", "Robotics", "Bio", "Networks", "Foods", "Group", "Digital", "Works"]
const LOCS = [
  ["Zurich, Switzerland", "CHF"], ["Geneva, Switzerland", "CHF"], ["Basel, Switzerland", "CHF"], ["Bern, Switzerland", "CHF"],
  ["London, United Kingdom", "GBP"], ["Berlin, Germany", "EUR"], ["Munich, Germany", "EUR"], ["Paris, France", "EUR"],
  ["Amsterdam, Netherlands", "EUR"], ["Dublin, Ireland", "EUR"], ["Zug, Switzerland", "CHF"], ["Lausanne, Switzerland", "CHF"],
  ["Bengaluru, India", "INR"], ["Mumbai, India", "INR"], ["Hyderabad, India", "INR"], ["Pune, India", "INR"], ["Delhi, India", "INR"],
  ["Singapore", "SGD"], ["Dubai, UAE", "USD"], ["New York, United States", "USD"], ["San Francisco, United States", "USD"],
  ["Toronto, Canada", "CAD"], ["Sydney, Australia", "AUD"], ["Tokyo, Japan", "JPY"], ["Remote", "CHF"], ["Remote — EU", "EUR"], ["Remote — Global", "USD"],
]
const TYPES = ["FULLTIME", "FULLTIME", "FULLTIME", "FULLTIME", "PARTTIME", "CONTRACT", "INTERNSHIP", "FREELANCE"]
const LEVELS = [["Intern", 0.4], ["Junior", 0.6], ["", 1], ["Senior", 1.6], ["Staff", 2.1], ["Principal", 2.6], ["Lead", 2.3], ["Head of", 3.2], ["Director of", 3.8], ["VP", 4.6]]
// role families per industry so titles read true-to-sector
const ROLES = {
  Technology: ["Software Engineer", "Backend Engineer", "Frontend Engineer", "Full-Stack Engineer", "DevOps Engineer", "Data Engineer", "Data Scientist", "ML Engineer", "Product Manager", "Product Designer", "QA Engineer", "Security Engineer", "Platform Engineer", "Mobile Engineer", "Solutions Architect"],
  Finance: ["Financial Analyst", "Investment Analyst", "Risk Manager", "Compliance Officer", "Accountant", "Auditor", "Portfolio Manager", "Actuary", "Treasury Analyst", "Quant Researcher"],
  Healthcare: ["Registered Nurse", "Clinical Research Associate", "Medical Writer", "Pharmacist", "Physiotherapist", "Healthcare Data Analyst", "Biomedical Engineer", "Care Coordinator", "Radiographer"],
  Education: ["Lecturer", "Curriculum Designer", "Academic Advisor", "Instructional Designer", "Research Assistant", "Education Consultant", "Learning Experience Designer"],
  Manufacturing: ["Process Engineer", "Quality Engineer", "Production Manager", "Supply Chain Analyst", "Maintenance Technician", "Industrial Designer", "Mechanical Engineer"],
  Retail: ["Store Manager", "Merchandiser", "Buyer", "E-commerce Manager", "Category Manager", "Visual Merchandiser", "Retail Analyst"],
  Legal: ["Corporate Counsel", "Paralegal", "Compliance Analyst", "Contract Manager", "Legal Operations Manager", "Patent Attorney"],
  Logistics: ["Logistics Coordinator", "Fleet Manager", "Warehouse Supervisor", "Demand Planner", "Freight Analyst", "Operations Manager"],
  Energy: ["Renewables Engineer", "Grid Analyst", "Sustainability Manager", "Power Systems Engineer", "Energy Trader", "HSE Officer"],
  Media: ["Content Strategist", "Video Producer", "Editor", "Social Media Manager", "Brand Manager", "Motion Designer", "Copywriter"],
  Government: ["Policy Analyst", "Program Officer", "Public Health Advisor", "Urban Planner", "Grants Manager", "Data Policy Lead"],
  Agriculture: ["Agronomist", "Farm Operations Manager", "Food Scientist", "Supply Chain Lead", "Sustainability Analyst"],
}
const SKILLS_BANK = ["communication", "leadership", "stakeholder management", "problem solving", "SQL", "Python", "analytics", "project management", "collaboration", "attention to detail", "budgeting", "reporting", "process improvement", "customer focus"]

function salaryFor(currency, mult) {
  const base = { CHF: 95000, EUR: 62000, GBP: 55000, USD: 105000, INR: 1400000, SGD: 78000, CAD: 82000, AUD: 95000, JPY: 6500000 }[currency] || 70000
  const lo = Math.round((base * mult * (0.85 + Math.random() * 0.1)) / 1000) * 1000
  const hi = Math.round((lo * (1.2 + Math.random() * 0.25)) / 1000) * 1000
  const fmt = (n) => currency === "INR" || currency === "JPY" ? `${(n / 100000).toFixed(1).replace(/\.0$/, "")}L` : n.toLocaleString("en-US")
  return `${currency} ${fmt(lo)}–${fmt(hi)}`
}

function description(title, company, industry, loc, skills) {
  return `${company} is hiring a ${title} to join our ${industry.toLowerCase()} team${loc.startsWith("Remote") ? " (remote-first)" : ` in ${loc}`}. ` +
    `You'll own real outcomes from day one — shipping work that reaches customers, partnering across teams, and raising the bar on quality. ` +
    `We look for people who are rigorous, curious and kind. ` +
    `What you'll bring: ${skills.slice(0, 3).join(", ")}, and a track record of getting things done. ` +
    `We offer competitive pay, learning budget, and a culture that trusts you with meaningful work.`
}

// ---- clear prior generated data ----
const prev = await p.user.findMany({ where: { source: "scale" }, select: { id: true } })
const prevIds = prev.map((u) => u.id)
if (prevIds.length) {
  await p.application.deleteMany({ where: { job: { postedById: { in: prevIds } } } })
  await p.job.deleteMany({ where: { postedById: { in: prevIds } } })
  await p.user.deleteMany({ where: { id: { in: prevIds } } })
}
console.log(`cleared ${prevIds.length} prior scale employers + their jobs`)

const hash = await bcrypt.hash("Company@2026!", 10)

// ---- companies (employer users) ----
const companies = []
const usedNames = new Set()
for (let i = 0; companies.length < 150 && i < 600; i++) {
  const name = `${pick(CO_PRE)} ${pick(CO_SUF)}`
  if (usedNames.has(name)) continue
  usedNames.add(name)
  const industry = pick(INDUSTRIES)
  const u = await p.user.create({
    data: {
      name, email: `talent@${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`, password: hash,
      role: "EMPLOYER", paid: true, paidAt: new Date(), idVerified: true, source: "scale",
      headline: `${industry} · Hiring across teams`, location: pick(LOCS)[0],
      profile: { create: {} },
    }, select: { id: true, name: true },
  })
  companies.push({ ...u, industry })
}
console.log(`created ${companies.length} companies`)

// ---- jobs (batched createMany for speed) ----
let total = 0
let batch = []
async function flush() {
  if (!batch.length) return
  await p.job.createMany({ data: batch })
  total += batch.length
  batch = []
  process.stdout.write(`  ${total} jobs\r`)
}
for (const co of companies) {
  const roles = ROLES[co.industry]
  const nJobs = rint(40, 110)
  for (let k = 0; k < nJobs; k++) {
    const [level, mult] = pick(LEVELS)
    const roleBase = pick(roles)
    const title = level ? (level.endsWith("of") ? `${level} ${roleBase}` : `${level} ${roleBase}`) : roleBase
    const [loc, currency] = pick(LOCS)
    const skills = [...SKILLS_BANK].sort(() => Math.random() - 0.5).slice(0, rint(4, 6))
    batch.push({
      title, company: co.name, industry: co.industry, location: loc,
      type: pick(TYPES), salary: Math.random() < 0.82 ? salaryFor(currency, mult) : null,
      remote: /remote/i.test(loc) || Math.random() < 0.25,
      description: description(title, co.name, co.industry, loc, skills),
      active: Math.random() < 0.94, views: rint(0, 4200), postedById: co.id,
      createdAt: daysAgo(rint(0, 90)),
    })
    if (batch.length >= 1000) await flush()
  }
}
await flush()
console.log(`\ncreated ${total} jobs across ${companies.length} companies`)

const grand = await p.job.count()
console.log(`\n✅ Scale seed done. Job board now holds ${grand.toLocaleString()} listings. Try the ⌘K search.`)
await p.$disconnect()
