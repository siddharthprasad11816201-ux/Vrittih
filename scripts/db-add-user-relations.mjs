/**
 * One-shot: give every personal-data model a real foreign key to User, so deleting a user
 * actually erases their data instead of leaving it behind forever.
 *
 *   node scripts/db-add-user-relations.mjs
 *
 * 26 models stored a userId as a plain String with no relation. That meant
 * prisma.user.delete() left their skill assessments, career profile, coach transcript,
 * consent records, saved jobs and OTP challenges in the database permanently — a
 * right-to-erasure problem, not just untidy data.
 *
 * The policy is deliberate and differs by category:
 *
 *   CASCADE  — personal data that should vanish with the person.
 *   SET NULL — aggregate telemetry. Deleting it would corrupt historical metrics, so the
 *              PERSONAL LINK is severed instead and the anonymous event survives.
 *   RETAIN   — employment, financial and placement records, which carry statutory
 *              retention obligations. Cascade-deleting payroll or redemption history would
 *              be worse than leaving it; these are allowlisted with the reason instead.
 */
import { readFileSync, writeFileSync } from "node:fs"

const FILE = "prisma/schema.prisma"
let src = readFileSync(FILE, "utf8")

const CASCADE = [
  "PostLike", "SkillEndorsement", "PostComment", "CareerDocument", "SkillProficiency",
  "CareerProfile", "CareerSnapshot", "RoadmapProgress", "SavedJob", "NotificationPref",
  "AvailabilityRule", "AvailabilityException", "InterviewConsent", "SkillAssessment",
  "UserProgress", "XpEvent", "ReviewItem", "CoachTurn", "OtpChallenge", "QuotaUsage",
  "MarketplaceInstall", "MarketplaceReview",
]
const SET_NULL = ["AnalyticsEvent"]

// Unique back-relation name per model, since User already has many relations.
const relName = (m) => `User${m}`

let changed = 0
const backRelations = []

for (const model of [...CASCADE, ...SET_NULL]) {
  const re = new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`, "m")
  const match = re.exec(src)
  if (!match) { console.log(`  SKIP ${model} (not found)`); continue }
  const [full, body] = match
  if (/user\s+User/.test(body)) { console.log(`  SKIP ${model} (already related)`); continue }

  const cascade = CASCADE.includes(model)
  const optional = /^\s*userId\s+String\?/m.test(body)
  const rel = `  user      User${optional ? "?" : ""}     @relation("${relName(model)}", fields: [userId], references: [id], onDelete: ${cascade ? "Cascade" : "SetNull"})`

  // SetNull requires a nullable scalar; Cascade works either way.
  if (!cascade && !optional) { console.log(`  SKIP ${model} (SetNull needs a nullable userId)`); continue }

  src = src.replace(full, full.replace(/\n\}$/, `\n${rel}\n}`))
  backRelations.push(`  ${lower(model)}Rows${" ".repeat(Math.max(1, 18 - model.length))}${model}[] @relation("${relName(model)}")`)
  changed++
}

function lower(s) { return s.charAt(0).toLowerCase() + s.slice(1) }

// Add the matching back-relations to User.
if (backRelations.length) {
  const um = /^model\s+User\s*\{([\s\S]*?)^\}/m.exec(src)
  if (!um) throw new Error("User model not found")
  const marker = "  savedSearches    SavedSearch[]"
  const block = `  // Personal-data back-relations. These exist so a user deletion CASCADES instead of\n  // leaving orphaned rows behind (see scripts/db-add-user-relations.mjs).\n${backRelations.join("\n")}\n${marker}`
  src = src.replace(marker, block)
}

writeFileSync(FILE, src)
console.log(`\nAdded ${changed} User relations (${CASCADE.length} cascade, ${SET_NULL.length} set-null).`)
console.log("Retained deliberately (statutory retention): Employee, CouponRedemption, PlacementRequest.")
