/* EduRankAI policy: internships are STRICTLY UNPAID except a designated few (which pay
 * in CHF). This enforces that on the Job table and removes the CHF-rule violation of ₹/
 * USD/"LPA" intern stipends: every internship whose salary is not an explicit CHF amount
 * is set to "Unpaid"; CHF-paid internships are kept (the paid few). Idempotent.
 *
 *   node scripts/interns-unpaid.mjs           # dry-run: report only
 *   node scripts/interns-unpaid.mjs --apply   # apply the change
 */
import { PrismaClient } from "@prisma/client"

const APPLY = process.argv.includes("--apply")
const prisma = new PrismaClient()

const isIntern = (j) => j.type === "INTERNSHIP" || /\bintern(ship)?s?\b/i.test(j.title || "")
// A legitimate paid intern pays in CHF ONLY — any ₹/INR/USD/LPA token (even mixed with
// CHF) is a CHF-rule violation and gets unpaid'd.
const isChfPaid = (s) => /\bchf\b/i.test(s || "") && !/₹|\bINR\b|\bUSD\b|\bLPA\b|\$|rs\.?\s*\d/i.test(s || "")

async function main() {
  const jobs = await prisma.job.findMany({ select: { id: true, title: true, type: true, salary: true } })
  const interns = jobs.filter(isIntern)
  const toUnpaid = interns.filter((j) => (j.salary || "").trim().toLowerCase() !== "unpaid" && !isChfPaid(j.salary))
  const keptPaid = interns.filter((j) => isChfPaid(j.salary))

  console.log(`Internships: ${interns.length}`)
  console.log(`  -> set to Unpaid: ${toUnpaid.length}`)
  console.log(`  -> kept (explicit CHF, the paid few): ${keptPaid.length}`)
  for (const j of keptPaid) console.log(`       CHF-paid: ${j.title} — ${j.salary}`)
  console.log(`  sample being unpaid'd:`)
  for (const j of toUnpaid.slice(0, 8)) console.log(`       ${j.title} — was: ${(j.salary || "(none)").slice(0, 60)}`)

  if (!APPLY) { console.log("\nDRY RUN — re-run with --apply to write."); await prisma.$disconnect(); return }
  let n = 0
  for (const j of toUnpaid) { await prisma.job.update({ where: { id: j.id }, data: { salary: "Unpaid" } }); n++ }
  console.log(`\nApplied: ${n} internships set to Unpaid.`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
