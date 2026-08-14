/**
 * Account recovery WITHOUT email: date of birth + security answers.
 *
 * Knowledge factors are weak, so what is tested here is mostly the defence in depth around
 * them — no enumeration oracle, hashed answers, a hard attempt cap, and no partial credit.
 *
 *   node scripts/test-recovery.mjs
 */
import { PrismaClient } from "@prisma/client"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rec-"))
function load(rel) {
  const dest = path.join(tmp, rel.replace(/\.ts$/, ".js"))
  if (fs.existsSync(dest)) return require(dest)
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8")
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
  }).outputText
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, out)
  return require(dest)
}
const r = load("lib/auth/recovery.ts")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()
let pass = 0, fail = 0
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + d}`); c ? pass++ : fail++ }
const eq = (n, g, w) => ok(n, JSON.stringify(g) === JSON.stringify(w), `got=${JSON.stringify(g)} want=${JSON.stringify(w)}`)
const TAG = "rec-" + Date.now()
const userIds = []

/* ---------------- answer normalisation ---------------- */
eq("case is insignificant", r.normalizeAnswer("New Delhi"), r.normalizeAnswer("new delhi"))
eq("surrounding space is insignificant", r.normalizeAnswer("  Rex  "), "rex")
eq("internal double spaces collapse", r.normalizeAnswer("St   Marys"), "st marys")
eq("punctuation is insignificant", r.normalizeAnswer("St. Mary's"), r.normalizeAnswer("St Marys"))
eq("accents are folded", r.normalizeAnswer("Zürich"), r.normalizeAnswer("Zurich"))
ok("a genuinely different answer still differs", r.normalizeAnswer("delhi") !== r.normalizeAnswer("mumbai"))

/* ---------------- setup validation ---------------- */
ok("an unknown question is rejected", r.validateAnswer("not_a_question", "x") === "unknown_question")
ok("a one-character answer is rejected", r.validateAnswer("first_pet", "a") === "too_short")
ok("a throwaway answer is rejected", r.validateAnswer("first_pet", "none") === "too_weak")
ok("a real answer is accepted", r.validateAnswer("first_pet", "Rex") === null)

const tooFew = r.validateSetup([{ questionKey: "first_pet", answer: "Rex" }])
ok("one answer is not enough to configure recovery", !tooFew.ok)
const dupes = r.validateSetup([
  { questionKey: "first_pet", answer: "Rex" },
  { questionKey: "first_pet", answer: "Max" },
])
ok("the same question twice is rejected", !dupes.ok && dupes.errors.some((e) => e.problem === "duplicate_question"))
const good = r.validateSetup([
  { questionKey: "first_pet", answer: "Rex" },
  { questionKey: "first_school", answer: "St Marys" },
])
ok("two distinct real answers configure recovery", good.ok && good.accepted.length === 2)

/* ---------------- date of birth ---------------- */
ok("a valid date parses", !!r.parseBirthDate("1995-03-14"))
eq("an impossible date is rejected", r.parseBirthDate("2026-02-31"), null)
eq("a malformed date is rejected", r.parseBirthDate("14/03/1995"), null)
eq("an implausibly recent birth year is rejected", r.parseBirthDate("2025-01-01"), null)
eq("an implausibly old birth year is rejected", r.parseBirthDate("1850-01-01"), null)
ok("comparison is by calendar day, so a stored timestamp still matches",
  r.sameCalendarDay(new Date("1995-03-14T22:45:00Z"), r.parseBirthDate("1995-03-14")))
ok("a different day does not match", !r.sameCalendarDay(new Date("1995-03-15"), r.parseBirthDate("1995-03-14")))
ok("a missing date never matches", !r.sameCalendarDay(null, new Date()))

/* ---------------- the decision ---------------- */
ok("all configured answers must be correct — no partial credit",
  !r.decideRecovery({ configuredCount: 2, correctCount: 1, attemptsUsed: 0 }).ok)
ok("both correct succeeds", r.decideRecovery({ configuredCount: 2, correctCount: 2, attemptsUsed: 0 }).ok)
ok("an unconfigured account cannot recover",
  r.decideRecovery({ configuredCount: 0, correctCount: 0, attemptsUsed: 0 }).reason === "not_configured")
ok("the attempt cap locks the flow even with correct answers",
  r.decideRecovery({ configuredCount: 2, correctCount: 2, attemptsUsed: r.MAX_RECOVERY_ATTEMPTS }).reason === "locked")

/* ---------------- no oracle ---------------- */
const route = fs.readFileSync(path.join(ROOT, "app/api/auth/recover/route.ts"), "utf8")
ok("every failure returns the SAME generic message", (route.match(/return fail\(\)/g) || []).length >= 6)
ok("the generic message reveals nothing specific",
  !/no such account|wrong date|incorrect answer|not found/i.test(r.GENERIC_FAILURE))
ok("the unauthenticated flow is rate limited and fails closed", route.includes("failOpen: false"))
// Compare against the CALL SITE, not the import line at the top of the file.
ok("the attempt is counted BEFORE the answers are compared",
  route.indexOf("recoveryAttempts: { increment: 1 }") < route.indexOf("await verifyPassword("))
ok("a successful reset issues a purpose-bound challenge, not a session",
  route.includes(`issueChallenge(user.id, "password_reset")`) && !route.includes("setAuthCookie"))
ok("the stateless-session limitation is stated, not hidden", route.includes("remain active until they expire"))

/* ---------------- against the real database ---------------- */
try {
  const dob = r.parseBirthDate("1995-03-14")
  const user = await prisma.user.create({
    data: {
      name: "Recover Me", email: `${TAG}@t.local`, password: await bcrypt.hash("original-pass", 12),
      role: "JOBSEEKER", dateOfBirth: dob,
    },
  })
  userIds.push(user.id)

  await prisma.securityAnswer.createMany({
    data: [
      { userId: user.id, questionKey: "first_pet", answerHash: await bcrypt.hash(r.normalizeAnswer("Rex"), 12) },
      { userId: user.id, questionKey: "first_school", answerHash: await bcrypt.hash(r.normalizeAnswer("St. Mary's"), 12) },
    ],
  })

  const stored = await prisma.securityAnswer.findMany({ where: { userId: user.id } })
  ok("answers are stored hashed, never readable", stored.every((a) => !a.answerHash.includes("Rex") && a.answerHash.startsWith("$2")))

  // A differently-typed but equivalent answer must still verify.
  const school = stored.find((a) => a.questionKey === "first_school")
  ok("an equivalently-typed answer still verifies",
    await bcrypt.compare(r.normalizeAnswer("st marys"), school.answerHash))
  ok("a wrong answer does not verify",
    !(await bcrypt.compare(r.normalizeAnswer("other school"), school.answerHash)))

  // Full decision path against real rows.
  let correct = 0
  for (const a of stored) {
    const given = { first_pet: "REX", first_school: "St Marys" }[a.questionKey]
    if (await bcrypt.compare(r.normalizeAnswer(given), a.answerHash)) correct++
  }
  ok("both real answers verify end to end", r.decideRecovery({ configuredCount: stored.length, correctCount: correct, attemptsUsed: 0 }).ok)

  // Lockout persists on the account.
  await prisma.user.update({ where: { id: user.id }, data: { recoveryAttempts: r.MAX_RECOVERY_ATTEMPTS, recoveryLockedAt: new Date() } })
  const locked = await prisma.user.findUnique({ where: { id: user.id }, select: { recoveryLockedAt: true } })
  ok("a locked account is recorded as locked", !!locked.recoveryLockedAt)

  // Deleting the user must take their answers with them.
  await prisma.user.delete({ where: { id: user.id } })
  userIds.length = 0
  ok("security answers are erased with the account",
    (await prisma.securityAnswer.count({ where: { userId: user.id } })) === 0)
} catch (e) {
  console.error("ERROR:", e.message)
  fail++
} finally {
  for (const id of userIds) await prisma.user.delete({ where: { id } }).catch(() => {})
  await prisma.$disconnect()
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
