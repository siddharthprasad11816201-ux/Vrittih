// One-shot production database setup. Run on the deploy host (or locally with a
// Postgres DATABASE_URL) once your env vars are set:
//   npm run deploy:db          # schema + super admin
//   npm run deploy:db:full     # + import the 437 EduRankAI jobs + company pages
//
// It validates DATABASE_URL is Postgres BEFORE changing anything, so it can never
// leave the schema in the half-flipped state that breaks `prisma db push`.
import { execSync } from "child_process"
import { readFileSync, existsSync } from "fs"

// Load .env into process.env (host env always wins) so child steps see the vars.
function loadEnv() {
  if (!existsSync(".env")) return
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
  }
}
loadEnv()

const withJobs = process.argv.includes("--jobs")
const run = (cmd) => { console.log(`\n$ ${cmd}`); execSync(cmd, { stdio: "inherit" }) }
const fail = (msg) => { console.error(`\n✗ ${msg}\n`); process.exit(1) }

// --- preflight ---
const url = process.env.DATABASE_URL || ""
if (!/^postgres(ql)?:\/\//.test(url)) {
  fail(`DATABASE_URL is not a Postgres URL (got "${url || "unset"}").\n` +
       `  Set it to your Postgres connection string first, e.g.\n` +
       `    DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"\n` +
       `  (On a host, set it in the dashboard's env. Locally, put it in .env.)\n` +
       `  To keep developing on SQLite instead, just run: npm run db:sqlite`)
}
const warnDefault = (k, bad) => { const v = process.env[k] || ""; if (!v || bad.includes(v)) console.warn(`⚠  ${k} is unset or a placeholder — set a real value before going live.`) }
if (process.env.NODE_ENV === "production") {
  warnDefault("JWT_SECRET", ["", "change-this-to-a-long-random-secret", "dev_secret_change_in_production"])
  warnDefault("SUPERADMIN_PASSWORD", ["", "change-me", "set-a-strong-password"])
  warnDefault("FACE_VECTOR_KEY", ["", "change-me-to-a-32-character-key!", "a-32-character-production-key!!!"])
}

console.log("Target Postgres:", url.replace(/:[^:@/]*@/, ":****@"))

try {
  run("node scripts/use-db.mjs postgres")   // flip provider
  run("npx prisma db push")                 // create/sync the schema
  run("node prisma/seed-admin.mjs")         // super admin
  if (withJobs) {
    run("node prisma/seed-edurankai.mjs")   // 437 product-tagged jobs
    run("node prisma/seed-companies.mjs")   // backfill company pages
  }
} catch (e) {
  fail(`A step failed: ${e.message}\n  Fix the issue and re-run. The schema is on Postgres now;\n  run 'npm run db:sqlite' if you want to return to local SQLite dev.`)
}

console.log(`\n✅ Database ready on Postgres.${withJobs ? " Jobs + company pages imported." : ""}`)
console.log("   Next:  npm run build   &&   npm start")
