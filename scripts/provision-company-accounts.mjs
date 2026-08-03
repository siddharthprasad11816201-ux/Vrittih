// Provision one recruiter (company) account per distinct company that has jobs,
// so the owner can sign in as each platform and see exactly that platform's
// applicants (the candidates API scopes by Job.postedById). Idempotent.
//
//   node scripts/provision-company-accounts.mjs            # DRY RUN (prints plan)
//   COMMIT=1 node scripts/provision-company-accounts.mjs   # apply + print credentials
//
// Runs against whatever DATABASE_URL / provider is active (use scripts/use-db.mjs).
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const prisma = new PrismaClient()
const COMMIT = process.env.COMMIT === "1"
const DOMAIN = process.env.RECRUITER_DOMAIN || "recruiter.vrittih.online"

const slugify = (s) =>
  String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "company"

function genPassword() {
  // Readable but strong: 3 groups of 4 url-safe chars + a digit.
  const chunk = () => crypto.randomBytes(3).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).padEnd(4, "x")
  return `${chunk()}-${chunk()}-${chunk()}${crypto.randomInt(10, 99)}`
}

// Only jobs currently owned by an import/aggregation/provisioned account are
// safe to reassign — NEVER a real self-registered employer's postings.
const SYS_SOURCES = ["edurankai", "catalog", "provisioned", "indeed"]
const SYS_EMAILS = ["careers@edurankai.in", "careers+edurankai@edurankai.in"]
const sysUsers = await prisma.user.findMany({
  where: { OR: [{ source: { in: SYS_SOURCES } }, { email: { in: SYS_EMAILS } }, { email: { endsWith: `@${DOMAIN}` } }] },
  select: { id: true },
})
const sysIds = new Set(sysUsers.map((u) => u.id))

const groups = await prisma.job.groupBy({ by: ["company"], _count: { _all: true } })
const companies = groups
  .map((g) => ({ company: (g.company || "").trim(), jobs: g._count._all }))
  .filter((g) => g.company)
  .sort((a, b) => b.jobs - a.jobs || a.company.localeCompare(b.company))   // stable order

console.log(`\nFound ${companies.length} distinct compan${companies.length === 1 ? "y" : "ies"} across jobs.`)
if (!COMMIT) console.log("DRY RUN — re-run with COMMIT=1 to create accounts + reassign jobs.\n")

const results = []
const usedSlugs = new Set()

for (const { company, jobs } of companies) {
  let slug = slugify(company)
  // Deterministic collision suffix (stable across runs) — a short hash of the
  // exact company string, so the derived email/slug is reproducible = idempotent.
  if (usedSlugs.has(slug)) slug = `${slug}-${crypto.createHash("sha1").update(company).digest("hex").slice(0, 6)}`
  usedSlugs.add(slug)
  const email = `${slug}@${DOMAIN}`

  if (!COMMIT) {
    console.log(`  • ${company}  →  ${email}  (${jobs} job${jobs === 1 ? "" : "s"})`)
    results.push({ company, email, jobs, status: "planned" })
    continue
  }

  let user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  let password = null
  if (!user) {
    password = genPassword()
    const hashed = await bcrypt.hash(password, 12)
    user = await prisma.user.create({
      data: {
        name: company, email, password: hashed,
        role: "EMPLOYER", paid: true, paidAt: new Date(), plan: "emp_scale",
        idVerified: true, source: "provisioned", profile: { create: {} },
      },
      select: { id: true },
    })
  } else {
    // Keep existing password (unrecoverable); just ensure recruiter capabilities.
    await prisma.user.update({ where: { id: user.id }, data: { role: "EMPLOYER", paid: true, plan: "emp_scale" } })
  }

  // Company hub owned by this recruiter — but never seize a hub already owned by
  // a real (non-system) user.
  const existingCo = await prisma.company.findUnique({ where: { slug }, select: { ownerId: true } }).catch(() => null)
  const keepOwner = existingCo && existingCo.ownerId && !sysIds.has(existingCo.ownerId) && existingCo.ownerId !== user.id
  await prisma.company.upsert({
    where: { slug },
    update: keepOwner ? { name: company, verified: true } : { ownerId: user.id, name: company, verified: true },
    create: { slug, name: company, ownerId: user.id, verified: true },
  }).catch(() => {})

  // Scope applicants: reassign ONLY jobs currently owned by a system/import
  // account (or this recruiter, for idempotent re-runs) — a real employer's jobs
  // are never touched.
  const reassignable = [...sysIds, user.id]
  const reassigned = await prisma.job.updateMany({ where: { company, postedById: { in: reassignable } }, data: { postedById: user.id } })

  results.push({ company, email, password: password || "(existing — unchanged)", jobs: reassigned.count, status: password ? "created" : "existing" })
  console.log(`  ✓ ${company}  →  ${email}  (${reassigned.count} jobs)  ${password ? "password: " + password : "(existing)"}`)
}

if (COMMIT) {
  console.log("\n================= RECRUITER CREDENTIALS =================")
  console.log(JSON.stringify(results, null, 2))
  console.log("========================================================")
  console.log("Sign in at /login → /dashboard/recruiter to view each platform's applicants.")
  console.log("Ask each recruiter to change their password in Account → Security.\n")
}

await prisma.$disconnect()
