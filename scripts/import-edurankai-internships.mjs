// Import EduRankAI's live internships into Vrittih as NATIVE jobs (the Vrittih
// applicant-form architecture) that ALSO link out to edurankai.in.
//
// Real data only: pulled live from https://www.edurankai.in/api/jobs-feed. Each
// INTERNSHIP role becomes a native Job (sourceKey "edurankai-internships" — which
// has NO JobSource row, so it is NOT aggregated → the native apply form shows),
// owned by the EduRankAI employer, with skills parsed from the description and a
// tailored internship ApplicationForm. Idempotent: re-running updates in place and
// migrates any existing aggregated duplicate (sourceKey "edurankai") to native.
//
//   node scripts/import-edurankai-internships.mjs            # import/refresh
//   node scripts/import-edurankai-internships.mjs --limit 5  # test a few
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const FEED = "https://www.edurankai.in/api/jobs-feed"
const SOURCE_KEY = "edurankai-internships" // native: intentionally NO JobSource row
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i > -1 ? parseInt(process.argv[i + 1], 10) : 0 })()

const p = new PrismaClient()

// Retry transient pooler drops (P1001 / reset / timeout). Each wrapped block is
// idempotent, so re-running it is safe.
async function withRetry(fn, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try { return await fn() }
    catch (e) {
      const transient = /P1001|ECONNRESET|ETIMEDOUT|terminating|Closed|timeout|Can't reach/i.test(String(e?.code || "") + " " + String(e?.message || ""))
      if (i === tries - 1 || !transient) throw e
      await new Promise((r) => setTimeout(r, 800 * (i + 1)))
    }
  }
}

const TYPES = ["FULLTIME", "PARTTIME", "INTERNSHIP", "CONTRACT", "FREELANCE"]
const normType = (t) => { const s = String(t || "").toUpperCase().replace(/[^A-Z]/g, ""); return TYPES.includes(s) ? s : "FULLTIME" }

// Pull the "Skills:" section out of the role description into tag names.
function parseSkills(desc) {
  const m = /(?:^|\n)\s*Skills?\s*:?\s*\n([\s\S]*?)(?:\n\s*\n|\n\s*(?:Eligibility|Responsibilities|Requirements|Who should|What you|About|Duration|Level|Team|Benefits|Compensation|Perks)\b|$)/i.exec(desc || "")
  if (!m) return []
  const items = m[1].split(/\n/).map((l) => l.replace(/^[\s\-•*·]+/, "").trim()).filter((l) => l.length >= 2 && l.length <= 40 && !/[:]$/.test(l))
  return [...new Set(items)].slice(0, 12)
}

// The tailored internship application form (advanced apply architecture).
const INTERN_FORM = {
  useProfile: true,
  requireResume: true,
  coverLetter: "optional",
  questions: JSON.stringify([
    { id: "availability", label: "Earliest start date and weekly availability (hours/week)", type: "text", options: [], required: true, help: "e.g. 'Available from 1 Sep, ~20 hrs/week'" },
    { id: "duration", label: "Preferred internship duration", type: "select", options: ["1 month", "2 months", "3 months", "6 months", "Flexible"], required: true, help: null },
    { id: "motivation", label: "Why are you a strong fit for this internship?", type: "textarea", options: [], required: true, help: "A few sentences on relevant experience, projects and drive." },
    { id: "student", label: "Are you currently a student? If so, institution and year", type: "text", options: [], required: false, help: null },
    { id: "links", label: "Portfolio / GitHub / LinkedIn (optional)", type: "text", options: [], required: false, help: null },
    { id: "location_ok", label: "Are you comfortable with the stated location / remote arrangement?", type: "boolean", options: [], required: false, help: null },
  ]),
  documents: JSON.stringify([
    { id: "resume", label: "Résumé / CV", required: true, accept: ".pdf,.doc,.docx", help: "PDF preferred." },
    { id: "transcript", label: "Latest transcript or marksheet (optional)", required: false, accept: ".pdf,.png,.jpg,.jpeg", help: null },
  ]),
  testId: null,
  testRequired: false,
  instructions: "Native Vrittih application for an EduRankAI internship — your profile is prefilled and tracked live through every stage. You can also apply on edurankai.in via the external link on the job page.",
}

async function ensureEmployer() {
  const email = "careers+edurankai@edurankai.in"
  let emp = await p.user.findUnique({ where: { email }, select: { id: true } })
  if (!emp) {
    emp = await p.user.create({
      data: {
        name: "EduRankAI", email, password: await bcrypt.hash("EduRankAI@2026!", 10),
        role: "EMPLOYER", paid: true, paidAt: new Date(), idVerified: true, source: "edurankai",
        headline: "AI for education, research and public good", location: "Guwahati, India", profile: { create: {} },
      },
      select: { id: true },
    })
    console.log("created EduRankAI employer")
  }
  await p.company.upsert({
    where: { slug: "edurankai" },
    update: { ownerId: emp.id, verified: true },
    create: {
      slug: "edurankai", name: "EduRankAI", ownerId: emp.id, verified: true, size: "51-200",
      tagline: "AI for education, research and public good", industry: "Technology", headquarters: "Guwahati, India",
      website: "https://www.edurankai.in",
      about: "EduRankAI builds AI-native products across education, research integrity, and public good — from foundational models to student tools.",
    },
  })
  return emp.id
}

async function main() {
  console.log("fetching feed:", FEED)
  const res = await fetch(FEED)
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`)
  const raw = await res.json()
  const items = (Array.isArray(raw) ? raw : raw.jobs || raw.data || raw.roles || [])
  let interns = items.filter((j) => normType(j.type) === "INTERNSHIP" && j.externalId && j.title)
  if (LIMIT) interns = interns.slice(0, LIMIT)
  console.log(`internships in feed: ${interns.length}`)

  const employerId = await ensureEmployer()

  // Pre-create every unique skill in ONE round-trip, then map name -> id.
  const allSkills = [...new Set(interns.flatMap((j) => parseSkills(j.description)))]
  if (allSkills.length) await withRetry(() => p.skill.createMany({ data: allSkills.map((name) => ({ name })), skipDuplicates: true }))
  const skillRows = await withRetry(() => p.skill.findMany({ where: { name: { in: allSkills } }, select: { id: true, name: true } }))
  const skillId = Object.fromEntries(skillRows.map((s) => [s.name, s.id]))
  console.log(`skills ready: ${skillRows.length}`)

  let created = 0, migrated = 0, updated = 0, withForm = 0, skillLinks = 0, done = 0
  for (const j of interns) {
   await withRetry(async () => {
    const extId = String(j.externalId)
    const fields = {
      title: String(j.title).slice(0, 200),
      description: String(j.description || j.title),
      company: String(j.company || "EduRankAI").slice(0, 120),
      industry: j.industry || "Education",
      location: String(j.location || "Remote").slice(0, 100),
      type: "INTERNSHIP",
      salary: j.salary ? String(j.salary).slice(0, 120) : null,
      remote: !!j.remote || /remote|virtual|global|worldwide/i.test(j.location || ""),
      applyUrl: (typeof j.applyUrl === "string" && /^https?:\/\//.test(j.applyUrl)) ? j.applyUrl : null, // external link
      govUrl: null,
      closesAt: j.closesAt ? new Date(j.closesAt) : null,
      active: true,
      postedById: employerId,
    }

    // Find an existing row for this role in either the aggregated or native key.
    const existing = await p.job.findFirst({
      where: { externalId: extId, sourceKey: { in: ["edurankai", SOURCE_KEY] } },
      select: { id: true, sourceKey: true },
    })
    let jobId
    if (existing) {
      await p.job.update({ where: { id: existing.id }, data: { ...fields, sourceKey: SOURCE_KEY, externalId: extId } })
      jobId = existing.id
      if (existing.sourceKey === "edurankai") migrated++; else updated++
    } else {
      const row = await p.job.create({ data: { ...fields, sourceKey: SOURCE_KEY, externalId: extId }, select: { id: true } })
      jobId = row.id
      created++
    }

    // Skills (replace set) — one delete + one batch insert
    const skills = parseSkills(j.description)
    await p.jobSkill.deleteMany({ where: { jobId } })
    const links = skills.map((name) => skillId[name]).filter(Boolean).map((sid) => ({ jobId, skillId: sid }))
    if (links.length) { const r = await p.jobSkill.createMany({ data: links, skipDuplicates: true }); skillLinks += r.count }

    // Tailored internship application form
    await p.applicationForm.upsert({ where: { jobId }, update: INTERN_FORM, create: { jobId, ...INTERN_FORM } })
    withForm++
   })
   if (++done % 100 === 0) console.log(`  …${done}/${interns.length}`)
  }

  console.log(`\ncreated=${created} migrated(from aggregated)=${migrated} updated=${updated}`)
  console.log(`application forms=${withForm} skill links=${skillLinks}`)
  const activeInterns = await p.job.count({ where: { sourceKey: SOURCE_KEY, active: true } })
  console.log(`active native internships now: ${activeInterns}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
