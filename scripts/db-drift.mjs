/**
 * Schema drift detection: diff the LIVE database against prisma/schema.prisma.
 *
 * Empty output = no drift. Any SQL printed is what would be needed to reconcile the
 * database with the schema, i.e. something changed outside migration history.
 *
 *   npm run db:drift
 *
 * Read-only: it never applies anything.
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs"
import path from "node:path"

const url = process.env.DATABASE_URL || (() => {
  try { return (readFileSync(".env", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]*)"?/m) || [])[1] || "" }
  catch { return "" }
})()
if (!url) { console.error("DATABASE_URL is not set."); process.exit(1) }

const isPg = /^postgres(ql)?:\/\//.test(url)
console.log(`Target: ${isPg ? "postgresql" : "sqlite"}  (${url.replace(/\/\/[^@]*@/, "//***@")})`)

// A relative sqlite URL (file:./dev.db) is interpreted relative to the SCHEMA directory,
// but --from-url resolves against the CWD. Rewrite it to an absolute path so both agree.
let fromUrl = url
if (!isPg && url.startsWith("file:")) {
  const rel = url.slice("file:".length)
  const candidates = [path.resolve("prisma", rel), path.resolve(rel)]
  const found = candidates.find((c) => existsSync(c))
  if (!found) {
    console.error("SQLite database not found. Looked in:\n  " + candidates.join("\n  "))
    process.exit(1)
  }
  fromUrl = "file:" + found.replace(/\\/g, "/")
}

// The schema's provider must match the live database or the diff is meaningless.
// The temp schema MUST live beside the real one: Prisma resolves a relative sqlite path
// (file:./dev.db) against the schema file, so a copy elsewhere would look for a nonexistent DB.
const TMP = "prisma/.drift-schema.prisma"
const schema = readFileSync("prisma/schema.prisma", "utf8")
  .replace(/provider = "(sqlite|postgresql)"/, `provider = "${isPg ? "postgresql" : "sqlite"}"`)
writeFileSync(TMP, schema)

try {
  const out = execFileSync("npx", [
    "prisma", "migrate", "diff",
    "--from-url", fromUrl,
    "--to-schema-datamodel", TMP,
    "--script",
  ], { encoding: "utf8", shell: process.platform === "win32" })

  const meaningful = out.split("\n").filter((l) => l.trim() && !l.trim().startsWith("--")).join("\n").trim()
  if (!meaningful) {
    console.log("\nNo drift — the database matches the schema.")
    process.exit(0)
  }
  console.log("\nDRIFT DETECTED. SQL required to reconcile the database with the schema:\n")
  console.log(out)
  console.log("\nInvestigate before deploying: something changed outside migration history.")
  process.exit(2)
} catch (e) {
  console.error("Drift check failed:", e.stdout || e.message)
  process.exit(1)
} finally {
  rmSync(TMP, { force: true })
}
