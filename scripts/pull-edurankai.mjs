// Pull the current EduRankAI careers roles from the source project's database and
// refresh prisma/data/edurankai-roles.json, so newly-posted roles flow into
// Vrittih (and closed ones drop out). Read-only: a single SELECT, no writes to
// the source. The 437 already imported came from here the same way.
//
//   node scripts/pull-edurankai.mjs          # show the diff, do not write
//   node scripts/pull-edurankai.mjs --write  # refresh the JSON
import { readFileSync, writeFileSync, existsSync } from "fs"
import pg from "pg"

const SRC_ENV = "C:/Users/user/Projects/edurankai/.env"
const OUT = "prisma/data/edurankai-roles.json"
const WRITE = process.argv.includes("--write")

function sourceDbUrl() {
  if (!existsSync(SRC_ENV)) throw new Error(`Source .env not found at ${SRC_ENV}`)
  const m = readFileSync(SRC_ENV, "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)
  if (!m) throw new Error("DATABASE_URL not found in the EduRankAI .env")
  return m[1].trim()
}

const client = new pg.Client({ connectionString: sourceDbUrl(), ssl: { rejectUnauthorized: false } })
await client.connect()

// Only OPEN roles — the same thing the live careers site shows. Join departments
// for the human name (brand mapping in seed-edurankai keys off department_name).
const { rows } = await client.query(`
  SELECT r.slug, r.title, r.level, r.function, r.engagement_type, r.location, r.duration,
         r.salary, r.about, r.responsibilities, r.skills, r.eligibility,
         r.department_id, d.name AS department_name, r.is_open, r.created_at
  FROM roles r
  LEFT JOIN departments d ON d.id = r.department_id
  WHERE r.is_open = true
  ORDER BY r.created_at ASC
`)
await client.end()

// Map to the exact shape seed-edurankai + the existing JSON use.
const mapped = rows.map(r => ({
  slug: r.slug,
  title: r.title,
  level: r.level,
  function: r.function,
  engagement_type: r.engagement_type,
  location: r.location,
  duration: r.duration,
  salary: r.salary,
  about: r.about,
  responsibilities: Array.isArray(r.responsibilities) ? r.responsibilities : [],
  skills: Array.isArray(r.skills) ? r.skills : [],
  eligibility: Array.isArray(r.eligibility) ? r.eligibility : [],
  product: null,
  products: [],
  openings: 1,
  department_id: r.department_id,
  department_name: r.department_name || r.department_id,
}))

// Diff against what's already imported.
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : []
const prevSlugs = new Set((Array.isArray(prev) ? prev : []).map(x => x.slug))
const liveSlugs = new Set(mapped.map(x => x.slug))
const added = mapped.filter(x => !prevSlugs.has(x.slug))
const removed = [...prevSlugs].filter(s => !liveSlugs.has(s))

console.log(`live open roles: ${mapped.length}`)
console.log(`already imported: ${prevSlugs.size}`)
console.log(`NEW roles: ${added.length}`)
if (added.length) console.log("  " + added.slice(0, 25).map(a => `${a.title} [${a.department_name}]`).join("\n  ") + (added.length > 25 ? `\n  …and ${added.length - 25} more` : ""))
console.log(`no-longer-open (would be removed): ${removed.length}`)

if (WRITE) {
  writeFileSync(OUT, JSON.stringify(mapped, null, 2) + "\n")
  console.log(`\n✔ wrote ${mapped.length} roles to ${OUT}. Now run: npm run seed:edurankai`)
} else {
  console.log(`\n(dry run — re-run with --write to refresh ${OUT})`)
}
