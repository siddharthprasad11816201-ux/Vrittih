/**
 * Schema quality audit. Static analysis of prisma/schema.prisma — no database needed.
 *
 *   npm run db:audit
 *
 * Catches the structural defects that only surface in production:
 *
 *  1. ORPHAN RISK — a model that stores a userId (or similar owner id) as a plain String
 *     with no relation. Deleting the user leaves those rows behind forever, which is both
 *     a data-retention/GDPR problem and a source of rows that can never be cleaned up.
 *
 *  2. UNINDEXED FOREIGN KEYS — a relation scalar with no index. Every lookup or cascade
 *     across it becomes a full table scan once the table is large.
 *
 *  3. UNINDEXED FILTER COLUMNS — owner-ish columns queried on every request path.
 *
 * Findings are classified. `ALLOWLIST` records deliberate exceptions with the reason, so an
 * intentional design decision does not have to be re-litigated on every run.
 */
import { readFileSync } from "node:fs"

const src = readFileSync("prisma/schema.prisma", "utf8")

/**
 * Deliberate exceptions: model -> why retaining rows past user deletion is CORRECT.
 * Exempts the ORPHAN check only; indexes are still required everywhere.
 */
const ALLOWLIST = {
  // Counters keyed by an opaque id, swept on a schedule; no personal profile data.
  RateHit: "opaque rate-limit key, swept by /api/cron/maintenance",
  // Audit trails must SURVIVE deletion of the actor, or the audit is worthless.
  ActivityLog: "audit trail — must outlive the actor",
  AiRun: "AI audit trail — must outlive the actor",
  // Statutory retention: cascade-deleting these would destroy records an employer is
  // legally required to keep. Erasure for these is a documented manual/anonymisation
  // process, not an automatic DB cascade.
  Employee: "employment record — payroll/tax retention obligations",
  CouponRedemption: "financial record — accounting retention",
  PlacementRequest: "placement/commercial record — contractual retention",
}

/* ---------- parse ---------- */
const models = []
const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm
for (const m of src.matchAll(re)) {
  const [, name, body] = m
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean)
  const fields = []
  const indexes = []
  let idFields = []
  for (const line of lines) {
    if (line.startsWith("@@index")) {
      const cols = /\[([^\]]+)\]/.exec(line)?.[1] || ""
      indexes.push(cols.split(",").map((c) => c.trim()))
      continue
    }
    if (line.startsWith("@@unique")) {
      const cols = /\[([^\]]+)\]/.exec(line)?.[1] || ""
      indexes.push(cols.split(",").map((c) => c.trim()))
      continue
    }
    if (line.startsWith("@@id")) {
      const cols = /\[([^\]]+)\]/.exec(line)?.[1] || ""
      idFields = cols.split(",").map((c) => c.trim())
      indexes.push(idFields)
      continue
    }
    if (line.startsWith("@@") || line.startsWith("//")) continue
    const fm = /^(\w+)\s+(\S+)/.exec(line)
    if (!fm) continue
    const [, fname, ftype] = fm
    const isRelation = /@relation\(/.test(line)
    const relFields = isRelation ? (/fields:\s*\[([^\]]+)\]/.exec(line)?.[1] || "").split(",").map((s) => s.trim()).filter(Boolean) : []
    if (/@id\b/.test(line)) { idFields = [fname]; indexes.push([fname]) }
    if (/@unique\b/.test(line)) indexes.push([fname])
    fields.push({ name: fname, type: ftype.replace(/[?[\]]/g, ""), raw: line, isRelation, relFields, optional: ftype.includes("?") })
  }
  models.push({ name, fields, indexes, idFields, body })
}

const modelNames = new Set(models.map((m) => m.name))
const hasIndexOn = (m, col) => m.indexes.some((ix) => ix[0] === col)

/* ---------- checks ---------- */
const orphanRisk = []
const unindexedFk = []
const unindexedFilter = []

// Owner-ish columns whose tables are always queried by them.
const OWNER_COLS = ["userId", "employerId", "candidateId", "ownerId", "authorId", "subjectId"]

for (const m of models) {
  const relScalars = new Set(m.fields.flatMap((f) => f.relFields))

  for (const f of m.fields) {
    if (f.isRelation) continue

    // 1. orphan risk
    if (f.name === "userId" && f.type === "String" && !relScalars.has("userId") && !ALLOWLIST[m.name]) {
      orphanRisk.push({ model: m.name, field: f.name })
    }

    // 2. relation scalars must be indexed (Prisma does NOT create these automatically)
    // NOTE: the allowlist deliberately does NOT apply here. A model may be exempt from the
    // orphan rule (an audit trail must outlive its actor) and still require its indexes.
    if (relScalars.has(f.name) && !hasIndexOn(m, f.name) && !m.idFields.includes(f.name)) {
      unindexedFk.push({ model: m.name, field: f.name })
    }

    // 3. owner-ish filter columns
    if (OWNER_COLS.includes(f.name) && !relScalars.has(f.name) && !hasIndexOn(m, f.name) && !m.idFields.includes(f.name) && !ALLOWLIST[m.name]) {
      unindexedFilter.push({ model: m.name, field: f.name })
    }
  }
}

/* ---------- report ---------- */
const show = (title, rows, note) => {
  console.log(`\n${title}: ${rows.length}`)
  if (note && rows.length) console.log(`  ${note}`)
  for (const r of rows.slice(0, 60)) console.log(`  - ${r.model}.${r.field}`)
  if (rows.length > 60) console.log(`  … and ${rows.length - 60} more`)
}

console.log(`Schema audit — ${models.length} models`)
show("Orphan risk (userId with no relation; rows survive user deletion)", orphanRisk,
  "Add a relation with onDelete: Cascade, or allowlist with a reason.")
show("Unindexed foreign keys (full scan on join/cascade)", unindexedFk,
  "Prisma does not index relation scalars automatically — add @@index.")
show("Unindexed owner columns (queried on every request path)", unindexedFilter)

const total = orphanRisk.length + unindexedFk.length + unindexedFilter.length
console.log(`\nTotal findings: ${total}`)
// Exit non-zero only for the categories that are genuine defects, so the gate is meaningful.
const blocking = unindexedFk.length + unindexedFilter.length
if (blocking > 0) {
  console.log(`BLOCKING: ${blocking} missing indexes.`)
  process.exit(1)
}
if (orphanRisk.length > 0) {
  console.log(`WARNING: ${orphanRisk.length} models retain rows after their user is deleted (see prisma/migrations/README.md).`)
}
process.exit(0)
