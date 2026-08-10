/* CHF-only enforcement: Vrittih shows salaries only as employers list them in CHF, and
 * NEVER estimates or converts pay. Any job salary carrying a non-CHF currency
 * (₹ / INR / LPA / Rs / ₨ / USD / rupee / lakh) is set to "Not disclosed" — honest, and
 * it removes the CHF-rule violation. "Unpaid" (interns) is left untouched; run
 * interns-unpaid.mjs FIRST so intern rows become Unpaid rather than "Not disclosed".
 *
 * Bulk updateMany (fast on Postgres + SQLite), idempotent, dry-run by default.
 *   node scripts/salary-chf-only.mjs           # report only
 *   node scripts/salary-chf-only.mjs --apply   # apply
 */
import { PrismaClient } from "@prisma/client"

const APPLY = process.argv.includes("--apply")
const prisma = new PrismaClient()

const FORBIDDEN = ["₹", "₨", "INR", "LPA", "Rs", "USD", "rupee", "lakh"]
const where = { AND: [{ OR: FORBIDDEN.map((s) => ({ salary: { contains: s } })) }, { NOT: { salary: "Unpaid" } }] }

async function main() {
  if (!APPLY) {
    console.log(`DRY RUN — jobs with a non-CHF currency to clear -> "Not disclosed": ${await prisma.job.count({ where })}`)
    console.log("Re-run with --apply to write.")
    await prisma.$disconnect(); return
  }
  const r = await prisma.job.updateMany({ where, data: { salary: "Not disclosed" } })
  console.log(`Applied — salaries set to "Not disclosed": ${r.count}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
