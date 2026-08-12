/**
 * Add missing indexes reported by db:audit.
 *
 *   npm run db:audit:fix
 *
 * Postgres does NOT create an index for a foreign key automatically, so every relation
 * scalar needs an explicit @@index or joins and cascade deletes become full table scans
 * once the table grows. This adds the missing ones in place.
 *
 * Only ADDS indexes. It never removes or reorders anything, and it skips a column already
 * covered as the FIRST column of an existing index (a compound index on [a,b] already
 * serves lookups on a).
 */
import { readFileSync, writeFileSync } from "node:fs"

const FILE = "prisma/schema.prisma"
let src = readFileSync(FILE, "utf8")

// Exempt from the OWNER-COLUMN heuristic only. Foreign keys are always indexed: an audit
// trail is queried by actor constantly, so skipping it would be a self-inflicted scan.
const OWNER_EXEMPT = new Set(["RateHit"])
const OWNER_COLS = ["userId", "employerId", "candidateId", "ownerId", "authorId", "subjectId"]

function parse(text) {
  const models = []
  for (const m of text.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [full, name, body] = m
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean)
    const fields = []
    const indexes = []
    let idFields = []
    for (const line of lines) {
      if (/^@@(index|unique)/.test(line)) {
        indexes.push((/\[([^\]]+)\]/.exec(line)?.[1] || "").split(",").map((c) => c.trim()))
        continue
      }
      if (line.startsWith("@@id")) {
        idFields = (/\[([^\]]+)\]/.exec(line)?.[1] || "").split(",").map((c) => c.trim())
        indexes.push(idFields)
        continue
      }
      if (line.startsWith("@@") || line.startsWith("//")) continue
      const fm = /^(\w+)\s+(\S+)/.exec(line)
      if (!fm) continue
      const [, fname] = fm
      const isRelation = /@relation\(/.test(line)
      const relFields = isRelation ? (/fields:\s*\[([^\]]+)\]/.exec(line)?.[1] || "").split(",").map((s) => s.trim()).filter(Boolean) : []
      if (/@id\b/.test(line)) { idFields = [fname]; indexes.push([fname]) }
      if (/@unique\b/.test(line)) indexes.push([fname])
      fields.push({ name: fname, isRelation, relFields })
    }
    models.push({ name, body, full, fields, indexes, idFields })
  }
  return models
}

const models = parse(src)
let added = 0
const report = []

for (const m of models) {
  const relScalars = new Set(m.fields.flatMap((f) => f.relFields))
  const covered = (col) => m.indexes.some((ix) => ix[0] === col) || m.idFields.includes(col)

  const need = []
  for (const f of m.fields) {
    if (f.isRelation) continue
    const isFk = relScalars.has(f.name)
    const isOwner = OWNER_COLS.includes(f.name) && !relScalars.has(f.name) && !OWNER_EXEMPT.has(m.name)
    if ((isFk || isOwner) && !covered(f.name) && !need.includes(f.name)) need.push(f.name)
  }
  if (!need.length) continue

  // Insert the new @@index lines just before the model's closing brace.
  const addition = need.map((c) => `  @@index([${c}])`).join("\n")
  const replaced = m.full.replace(/\n\}$/, `\n${addition}\n}`)
  src = src.replace(m.full, replaced)
  added += need.length
  report.push(`${m.name}: ${need.join(", ")}`)
}

if (added) {
  writeFileSync(FILE, src)
  console.log(`Added ${added} indexes across ${report.length} models:`)
  for (const r of report) console.log(`  ${r}`)
  console.log("\nNow run:  npx prisma db push  &&  npm run db:migrations:build")
} else {
  console.log("No missing indexes — nothing to do.")
}
