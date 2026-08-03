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

const groups = await prisma.job.groupBy({ by: ["company"], _count: { _all: true } })
const companies = groups
  .map((g) => ({ company: (g.company || "").trim(), jobs: g._count._all }))
  .filter((g) => g.company)
  .sort((a, b) => b.jobs - a.jobs)

console.log(`\nFound ${companies.length} distinct compan${companies.length === 1 ? "y" : "ies"} across jobs.`)
if (!COMMIT) console.log("DRY RUN — re-run with COMMIT=1 to create accounts + reassign jobs.\n")

const results = []
const usedSlugs = new Set()

for (const { company, jobs } of companies) {
  let slug = slugify(company)
  while (usedSlugs.has(slug)) slug = `${slug}-${crypto.randomInt(2, 99)}`
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

  // Company hub owned by this recruiter.
  await prisma.company.upsert({
    where: { slug },
    update: { ownerId: user.id, name: company, verified: true },
    create: { slug, name: company, ownerId: user.id, verified: true },
  }).catch(() => {})

  // Scope applicants: this company's jobs are owned by this recruiter.
  const reassigned = await prisma.job.updateMany({ where: { company }, data: { postedById: user.id } })

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
