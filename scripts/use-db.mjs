// Flip the Prisma datasource provider between SQLite (local dev) and Postgres
// (production) without hand-editing the schema. The url stays env-driven.
//   node scripts/use-db.mjs postgres   # before deploying
//   node scripts/use-db.mjs sqlite     # back to local dev
import { readFileSync, writeFileSync } from "fs"

const map = { postgres: "postgresql", postgresql: "postgresql", pg: "postgresql", sqlite: "sqlite", sqlite3: "sqlite" }
const provider = map[(process.argv[2] || "").toLowerCase()]
if (!provider) { console.error("Usage: node scripts/use-db.mjs <sqlite|postgres>"); process.exit(1) }

const path = "prisma/schema.prisma"
let s = readFileSync(path, "utf8")
if (!/provider\s*=\s*"(sqlite|postgresql)"/.test(s)) { console.error("Could not find the datasource provider line."); process.exit(1) }
s = s.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${provider}"`)
writeFileSync(path, s)

console.log(`✔ Prisma datasource provider set to "${provider}".`)
if (provider === "postgresql") {
  console.log("Next:")
  console.log("  1. Set DATABASE_URL to your Postgres URL (Neon/Railway/Supabase/RDS).")
  console.log("  2. npx prisma db push          # create the schema")
  console.log("  3. npm run seed:admin          # super admin")
  console.log("  4. npm run seed:companies      # backfill company pages (after any job import)")
  console.log("  ci() in lib/db.ts auto-enables case-insensitive search on Postgres.")
} else {
  console.log("Local dev: keep DATABASE_URL=\"file:./dev.db\".")
}
