// Flip the Prisma datasource provider between SQLite (local dev) and Postgres
// (production) without hand-editing the schema. The url stays env-driven.
//   node scripts/use-db.mjs postgres   # before deploying
//   node scripts/use-db.mjs sqlite     # back to local dev
import { readFileSync, writeFileSync, existsSync } from "fs"

const map = { postgres: "postgresql", postgresql: "postgresql", pg: "postgresql", sqlite: "sqlite", sqlite3: "sqlite" }
const provider = map[(process.argv[2] || "").toLowerCase()]
if (!provider) { console.error("Usage: node scripts/use-db.mjs <sqlite|postgres>"); process.exit(1) }

// Read DATABASE_URL straight from .env (node scripts don't auto-load it).
function envDatabaseUrl() {
  try {
    if (!existsSync(".env")) return ""
    const m = readFileSync(".env", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]*)"?/m)
    return m ? m[1].trim() : ""
  } catch { return "" }
}

const path = "prisma/schema.prisma"
let s = readFileSync(path, "utf8")
if (!/provider\s*=\s*"(sqlite|postgresql)"/.test(s)) { console.error("Could not find the datasource provider line."); process.exit(1) }
s = s.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${provider}"`)
writeFileSync(path, s)

console.log(`✔ Prisma datasource provider set to "${provider}".`)

const url = envDatabaseUrl()
const urlIsPg = /^postgres(ql)?:\/\//.test(url)
const urlIsSqlite = /^file:/.test(url)

if (provider === "postgresql") {
  if (!urlIsPg) {
    console.log("")
    console.log("⚠  DATABASE_URL is NOT a Postgres URL" + (url ? ` (it's "${url}")` : " (unset") + ".")
    console.log("   `prisma generate`, `prisma db push`, `next build` and the dev server")
    console.log("   will FAIL until you point DATABASE_URL at Postgres — or run `npm run db:sqlite`.")
    console.log("")
    console.log("   To deploy: set DATABASE_URL in your HOST's env (Neon/Railway/Supabase), e.g.")
    console.log('     DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"')
    console.log("   then, there: npx prisma db push && npm run seed:admin")
  } else {
    console.log("Next: npx prisma db push  →  npm run seed:admin  (+ seed:companies after any import)")
  }
  console.log("ci() in lib/db.ts auto-enables case-insensitive search on Postgres.")
} else {
  if (!urlIsSqlite && url) console.log(`Note: DATABASE_URL is "${url}" — for local dev it should be "file:./dev.db".`)
  else console.log("Local dev: DATABASE_URL should be \"file:./dev.db\".")
}
