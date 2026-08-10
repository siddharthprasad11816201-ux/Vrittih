/* ICIRE — self-trained semantic skill model, retrained on Vrittih's OWN data.
 * Learns skill<->skill relatedness (normalised PMI) from how skills co-occur across
 * THREE in-house sources: live jobs, candidate profiles, and courses. No external
 * model, no download, no LLM — pure statistics over your own corpus.
 *
 * Run:  npm run train:semantic
 * (self-compiles lib/career/taxonomy.ts + train.ts, reads the DB, writes
 *  lib/career/semantic-model.ts, which the semantic layer blends with the ontology.) */
import { createRequire } from "module"
import { writeFileSync, mkdtempSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, resolve, join } from "path"
import { tmpdir } from "os"
import { execSync } from "child_process"

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

// --- self-compile the pure TS deps to a temp dir (CJS) so we can require them ---
const OUT = mkdtempSync(join(tmpdir(), "vrittih-train-"))
console.log("Compiling taxonomy + trainer…")
execSync(
  `node "${join(ROOT, "node_modules/typescript/bin/tsc")}" lib/career/taxonomy.ts lib/career/train.ts ` +
  `--outDir "${OUT}" --module commonjs --target es2019 --skipLibCheck --moduleResolution node`,
  { cwd: ROOT, stdio: "inherit" }
)
// tsc collapses the common input root (lib/career) so output is flat in OUT.
const tax = require(join(OUT, "taxonomy.js"))
const { computeModel, serializeModel } = require(join(OUT, "train.js"))
const { PrismaClient } = require("@prisma/client")

// --- shared skill detection (mirrors engine.detect's DIRECT detection) ---
const aliases = tax.allAliases() // [{ alias: normalizedKey, canon }]
const norm = (s) => String(s || "").toLowerCase().replace(/[-._/]/g, " ").replace(/\s+/g, " ").trim()
function detect(text) {
  const t = " " + norm(text) + " "
  const tokens = new Set(norm(text).split(/[^a-z0-9+#]+/).filter(Boolean))
  const found = new Set()
  for (const { alias, canon } of aliases) {
    const hit = alias.includes(" ") ? t.includes(" " + alias + " ") : tokens.has(alias)
    if (hit) found.add(canon)
  }
  return found
}
const canonAll = (arr) => (arr || []).map((s) => tax.canonical(s)).filter(Boolean)
// Course.skills may be a JSON array string or a CSV — accept both.
function parseSkillField(v) {
  if (!v) return []
  try { const j = JSON.parse(v); if (Array.isArray(j)) return j.map(String) } catch {}
  return String(v).split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
}

async function main() {
  const prisma = new PrismaClient()
  const docs = []
  const sources = { jobs: 0, profiles: 0, courses: 0 }

  // 1) JOBS — title/description/industry + tagged skills
  const jobs = await prisma.job.findMany({ select: { title: true, description: true, industry: true, skills: { include: { skill: true } } } })
  for (const j of jobs) {
    const set = detect([j.title, j.description, j.industry].filter(Boolean).join(". "))
    for (const c of canonAll((j.skills || []).map((s) => s.skill?.name))) set.add(c)
    if (set.size >= 2) { docs.push([...set]); sources.jobs++ }
  }

  // 2) PROFILES — a candidate's own skill-set (tagged skills + skills named in their
  //    experience/headline/bio). Captures real human skill combinations.
  const users = await prisma.user.findMany({
    select: { headline: true, bio: true, skills: { include: { skill: true } }, experience: { select: { title: true, description: true } } },
  })
  for (const u of users) {
    const set = new Set(canonAll((u.skills || []).map((s) => s.skill?.name)))
    const text = [u.headline, u.bio, ...(u.experience || []).flatMap((e) => [e.title, e.description])].filter(Boolean).join(". ")
    for (const c of detect(text)) set.add(c)
    if (set.size >= 2) { docs.push([...set]); sources.profiles++ }
  }

  // 3) COURSES — declared skills + title/summary + lesson skills
  const courses = await prisma.course.findMany({ select: { title: true, summary: true, skills: true, lessons: { select: { title: true, skill: true } } } })
  for (const c of courses) {
    const set = new Set(canonAll(parseSkillField(c.skills)))
    for (const d of detect([c.title, c.summary].filter(Boolean).join(". "))) set.add(d)
    for (const l of c.lessons || []) { const cc = tax.canonical(l.skill || ""); if (cc) set.add(cc); for (const d of detect(l.title || "")) set.add(d) }
    if (set.size >= 2) { docs.push([...set]); sources.courses++ }
  }
  await prisma.$disconnect()

  const at = new Date().toISOString()
  const model = computeModel(docs, { isSoft: (s) => tax.categoryOf(s) === "soft", at, sources, dims: 32, epochs: 250 })
  const dest = resolve(ROOT, "lib/career/semantic-model.ts")
  writeFileSync(dest, serializeModel(model))

  console.log(`\nTrained on ${model.trained.docs} documents (${sources.jobs} jobs, ${sources.profiles} profiles, ${sources.courses} courses)`)
  console.log(`${model.trained.skills} skills, kept ${model.trained.pairs} pairs. Wrote ${dest}`)
  const top = Object.entries(model.pairs).sort((a, b) => b[1] - a[1]).slice(0, 10)
  for (const [k, v] of top) console.log("   ", k.replace("|", " ~ "), v)
}
main().catch((e) => { console.error(e); process.exit(1) })
