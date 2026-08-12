/**
 * Migration integrity gate. Run in the test suite so a stale migration can never be
 * committed again.
 *
 *   npm run db:check
 *
 * THE BUG THIS PREVENTS: the baseline migration was generated once and the schema then
 * evolved via `prisma db push` for weeks. The committed migration silently fell 12 models
 * behind, so `prisma migrate deploy` against a fresh production database would have built
 * the WRONG SCHEMA — and nothing would have complained until runtime.
 *
 * Two independent checks, both deterministic and needing no database server:
 *
 *  1. FRESHNESS — regenerate the DDL from the current schema and compare it to what is
 *     committed. Any difference means the migration no longer describes the schema.
 *
 *  2. ROUND-TRIP — build a throwaway SQLite migration set, apply it to a shadow file, and
 *     diff the result back against the schema. Empty diff proves the migration set
 *     actually reproduces the model graph, rather than merely looking plausible.
 *     (SQLite is used because its shadow database is just a file; the committed migration
 *     targets Postgres, which cannot be validated here without a server — see README.)
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const SCHEMA = "prisma/schema.prisma"
const MIGRATION = "prisma/migrations/0_init/migration.sql"

const run = (args) =>
  execFileSync("npx", args, { encoding: "utf8", shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] })

let failed = false
const ok = (n) => console.log(`PASS  ${n}`)
const bad = (n, detail) => { console.log(`FAIL  ${n}\n      ${detail}`); failed = true }

const schema = readFileSync(SCHEMA, "utf8")

/* ---------- 1. freshness ---------- */
const pgSchemaPath = "prisma/.check-pg.prisma"
try {
  writeFileSync(pgSchemaPath, schema.replace(/provider = "(sqlite|postgresql)"/, 'provider = "postgresql"'))
  const fresh = run(["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", pgSchemaPath, "--script"])
  const committed = existsSync(MIGRATION) ? readFileSync(MIGRATION, "utf8") : ""

  const normalize = (s) => s.replace(/\r\n/g, "\n").trim()
  if (!committed) {
    bad("migration exists", `${MIGRATION} is missing.`)
  } else if (normalize(fresh) !== normalize(committed)) {
    // Report WHAT drifted, so the fix is obvious rather than a mystery.
    const freshTables = new Set([...fresh.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]))
    const commTables = new Set([...committed.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]))
    const missing = [...freshTables].filter((t) => !commTables.has(t))
    const extra = [...commTables].filter((t) => !freshTables.has(t))
    bad(
      "committed migration matches the schema",
      `The migration is STALE. Regenerate with: npm run db:migrations:build\n` +
      (missing.length ? `      Tables in schema but NOT in the migration: ${missing.join(", ")}\n` : "") +
      (extra.length ? `      Tables in the migration but NOT in the schema: ${extra.join(", ")}\n` : "") +
      (!missing.length && !extra.length ? `      Same tables, but columns/indexes/constraints differ.` : ""),
    )
  } else {
    const tables = (committed.match(/CREATE TABLE/g) || []).length
    ok(`committed migration matches the schema exactly (${tables} tables)`)
  }
} catch (e) {
  bad("freshness check ran", String(e.stdout || e.message))
} finally {
  rmSync(pgSchemaPath, { force: true })
}

/* ---------- 2. round-trip ---------- */
const tmp = mkdtempSync(path.join(tmpdir(), "migcheck-"))
try {
  const liteSchema = path.join(tmp, "schema.prisma")
  writeFileSync(liteSchema, schema.replace(/provider = "(sqlite|postgresql)"/, 'provider = "sqlite"'))

  const migDir = path.join(tmp, "migrations", "0_init")
  mkdirSync(migDir, { recursive: true })
  // Prisma needs the connector lock to read a migrations directory at all.
  writeFileSync(path.join(tmp, "migrations", "migration_lock.toml"), 'provider = "sqlite"\n')
  const liteSql = run(["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", liteSchema, "--script"])
  writeFileSync(path.join(migDir, "migration.sql"), liteSql)

  // Apply the migration set to a shadow database, then diff the RESULT back at the schema.
  const shadow = "file:" + path.join(tmp, "shadow.db").replace(/\\/g, "/")
  const back = run([
    "prisma", "migrate", "diff",
    "--from-migrations", path.join(tmp, "migrations"),
    "--to-schema-datamodel", liteSchema,
    "--shadow-database-url", shadow,
    "--script",
  ])
  const meaningful = back.split("\n").filter((l) => l.trim() && !l.trim().startsWith("--")).join("\n").trim()
  if (meaningful) {
    bad("migrations reproduce the schema exactly", `Applying the migrations leaves a difference:\n${back.slice(0, 1200)}`)
  } else {
    ok("migrations applied to an empty database reproduce the schema exactly (round-trip)")
  }
} catch (e) {
  bad("round-trip check ran", String(e.stdout || e.message).slice(0, 800))
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

console.log(failed ? "\nMigration check FAILED" : "\nMigration check passed")
process.exit(failed ? 1 : 0)
