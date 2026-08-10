/* EduRankAI policy: internships are STRICTLY UNPAID except a designated few (which pay
 * in CHF). This enforces that on the Job table and removes the CHF-rule violation of ₹/
 * INR/USD/"LPA" intern stipends: every internship whose salary is not a clean CHF amount
 * is set to "Unpaid"; CHF-only internships are kept (the paid few).
 *
 * Bulk updateMany (fast on Postgres + SQLite), idempotent, dry-run by default.
 *   node scripts/interns-unpaid.mjs            # report only
 *   node scripts/interns-unpaid.mjs --apply    # apply
 */
import { PrismaClient } from "@prisma/client"

const APPLY = process.argv.includes("--apply")
const prisma = new PrismaClient()

const INTERN = { OR: [{ type: "INTERNSHIP" }, { title: { contains: "Intern" } }] }
const FORBIDDEN = ["₹", "₨", "INR", "LPA", "Rs", "USD", "rupee", "lakh"] // non-CHF currency tokens present in the data
const forbiddenOr = FORBIDDEN.map((s) => ({ salary: { contains: s } }))

async function main() {
  // A) interns with no CHF in their salary (incl. null / "Not Disclosed" / ₹ / USD) -> Unpaid
  const whereNoChf = { AND: [INTERN, { NOT: { salary: { contains: "CHF" } } }, { NOT: { salary: "Unpaid" } }] }
  // B) interns that DO mention CHF but ALSO a forbidden currency (mixed) -> Unpaid (not CHF-only)
  const whereMixed = { AND: [INTERN, { salary: { contains: "CHF" } }, { OR: forbiddenOr }] }

  if (!APPLY) {
    const [a, b, keptPaid] = await Promise.all([
      prisma.job.count({ where: whereNoChf }),
      prisma.job.count({ where: whereMixed }),
      prisma.job.count({ where: { AND: [INTERN, { salary: { contains: "CHF" } }, { NOT: { OR: forbiddenOr } }] } }),
    ])
    console.log(`DRY RUN — interns -> Unpaid: ${a + b} (no-CHF ${a} + mixed-currency ${b}); kept CHF-only (paid few): ${keptPaid}`)
    console.log("Re-run with --apply to write.")
    await prisma.$disconnect(); return
  }
  const a = await prisma.job.updateMany({ where: whereNoChf, data: { salary: "Unpaid" } })
  const b = await prisma.job.updateMany({ where: whereMixed, data: { salary: "Unpaid" } })
  const keptPaid = await prisma.job.count({ where: { AND: [INTERN, { salary: { contains: "CHF" } }, { NOT: { OR: forbiddenOr } }] } })
  console.log(`Applied — interns set to Unpaid: ${a.count + b.count}; kept CHF-only (paid few): ${keptPaid}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
