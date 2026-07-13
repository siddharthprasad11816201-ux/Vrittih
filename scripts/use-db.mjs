// Flip the Prisma datasource provider between SQLite (local dev) and Postgres
// (production). The url stays env-driven.
//   node scripts/use-db.mjs sqlite            # back to local dev (always allowed)
//   node scripts/use-db.mjs postgres          # only if DATABASE_URL is Postgres
//   node scripts/use-db.mjs postgres --force  # flip anyway (advanced)
//
// Flipping to Postgres is REFUSED unless DATABASE_URL is actually a Postgres URL,
// so you can't leave the schema in a half-flipped state that breaks every prisma
// command. On a deploy host (where DATABASE_URL is already Postgres) it just works.
import { readFileSync, writeFileSync, existsSync } from "fs"

const map = { postgres: "postgresql", postgresql: "postgresql", pg: "postgresql", sqlite: "sqlite", sqlite3: "sqlite" }
const provider = map[(process.argv[2] || "").toLowerCase()]
const force = process.argv.includes("--force")
if (!provider) { console.error("Usage: node scripts/use-db.mjs <sqlite|postgres> [--force]"); process.exit(1) }

// DATABASE_URL from the process env (host) or, failing that, the .env file (local).
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    if (existsSync(".env")) {
      const m = readFileSync(".env", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]*)"?/m)
      if (m) return m[1].trim()
    }
  } catch { /* ignore */ }
  return ""
}

const url = databaseUrl()
const urlIsPg = /^postgres(ql)?:\/\//.test(url)

if (provider === "postgresql" && !urlIsPg && !force) {
  console.error("")
  console.error("✗ Refusing to switch to Postgres: DATABASE_URL is not a Postgres URL")
  console.error(`  (it's ${url ? `"${url}"` : "unset"}).`)
  console.error("")
  console.error("  Postgres needs a database first. Do ONE of these:")
  console.error("   • Deploying? Set DATABASE_URL on your host, then run: npm run deploy:db")
  console.error("   • Have a Postgres URL locally? Put it in .env, then re-run this.")
  console.error("   • Just developing? Stay on SQLite — you don't need this command.")
  console.error("")
  console.error("  (Advanced: pass --force to flip anyway.)")
  process.exit(1)
}

const path = "prisma/schema.prisma"
let s = readFileSync(path, "utf8")
if (!/provider\s*=\s*"(sqlite|postgresql)"/.test(s)) { console.error("Could not find the datasource provider line."); process.exit(1) }
writeFileSync(path, s.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${provider}"`))

console.log(`✔ Prisma datasource provider set to "${provider}".`)
if (provider === "postgresql") {
  console.log("Next: npx prisma db push  →  npm run seed:admin   (or just: npm run deploy:db)")
  console.log("ci() in lib/db.ts auto-enables case-insensitive search on Postgres.")
} else {
  console.log("Local dev: DATABASE_URL should be \"file:./dev.db\".")
}
