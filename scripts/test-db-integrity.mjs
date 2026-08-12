/**
 * Database integrity tests — proves the schema behaves, not just that it compiles.
 *
 *   node scripts/test-db-integrity.mjs
 *
 * Guards the right-to-erasure fix: 22 models used to keep a user's personal data forever
 * because userId was a plain String with no foreign key.
 */
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
let pass = 0, fail = 0
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + d}`); c ? pass++ : fail++ }
const TAG = "dbint-" + Date.now()
let uid = null

try {
  const u = await prisma.user.create({ data: { name: "Erasure Test", email: `${TAG}@t.local`, password: "x", role: "JOBSEEKER" } })
  uid = u.id

  // Personal data across the models that previously orphaned.
  await prisma.skillAssessment.create({ data: { userId: uid, skill: "Node.js", score: 0.9 } })
  await prisma.userProgress.create({ data: { userId: uid, xp: 100 } })
  await prisma.xpEvent.create({ data: { userId: uid, amount: 10, reason: "test" } })
  await prisma.coachTurn.create({ data: { userId: uid, role: "user", message: "hello" } })
  await prisma.skillProficiency.create({ data: { userId: uid, skill: "Node.js", confidence: 0.8 } })
  await prisma.savedJob.create({ data: { userId: uid, jobId: "nonexistent" } }).catch(() => {})
  await prisma.notificationPref.create({ data: { userId: uid, category: "job_alert", inApp: true, email: false } })
  await prisma.availabilityRule.create({ data: { userId: uid, weekday: 1, startMinute: 540, endMinute: 1020 } })
  await prisma.otpChallenge.create({ data: { userId: uid, codeHash: "x", expiresAt: new Date(Date.now() + 60000) } })
  await prisma.quotaUsage.create({ data: { userId: uid, quota: "ai_calls_per_month", period: "2026-08", used: 3 } })
  await prisma.analyticsEvent.create({ data: { userId: uid, name: "test.event" } })

  const before = {
    assessments: await prisma.skillAssessment.count({ where: { userId: uid } }),
    progress: await prisma.userProgress.count({ where: { userId: uid } }),
    xp: await prisma.xpEvent.count({ where: { userId: uid } }),
    coach: await prisma.coachTurn.count({ where: { userId: uid } }),
    prof: await prisma.skillProficiency.count({ where: { userId: uid } }),
    prefs: await prisma.notificationPref.count({ where: { userId: uid } }),
    avail: await prisma.availabilityRule.count({ where: { userId: uid } }),
    otp: await prisma.otpChallenge.count({ where: { userId: uid } }),
    quota: await prisma.quotaUsage.count({ where: { userId: uid } }),
    analytics: await prisma.analyticsEvent.count({ where: { userId: uid } }),
  }
  ok("personal data was written across the previously-orphaning models",
    Object.values(before).every((n) => n > 0), JSON.stringify(before))

  // THE test: deleting the user must erase their personal data.
  await prisma.user.delete({ where: { id: uid } })
  uid = null

  const after = {
    assessments: await prisma.skillAssessment.count({ where: { userId: u.id } }),
    progress: await prisma.userProgress.count({ where: { userId: u.id } }),
    xp: await prisma.xpEvent.count({ where: { userId: u.id } }),
    coach: await prisma.coachTurn.count({ where: { userId: u.id } }),
    prof: await prisma.skillProficiency.count({ where: { userId: u.id } }),
    prefs: await prisma.notificationPref.count({ where: { userId: u.id } }),
    avail: await prisma.availabilityRule.count({ where: { userId: u.id } }),
    otp: await prisma.otpChallenge.count({ where: { userId: u.id } }),
    quota: await prisma.quotaUsage.count({ where: { userId: u.id } }),
  }
  ok("deleting the user CASCADES away all of their personal data",
    Object.values(after).every((n) => n === 0), JSON.stringify(after))

  // Telemetry is retained but ANONYMISED — deleting it would corrupt historical metrics.
  const orphanTelemetry = await prisma.analyticsEvent.count({ where: { userId: u.id } })
  const anonymised = await prisma.analyticsEvent.count({ where: { name: "test.event", userId: null } })
  ok("telemetry keeps the event but severs the personal link", orphanTelemetry === 0 && anonymised > 0,
    `linked=${orphanTelemetry} anonymised=${anonymised}`)
  await prisma.analyticsEvent.deleteMany({ where: { name: "test.event", userId: null } })

  // A foreign key must actually be enforced, not merely declared.
  let rejected = false
  try { await prisma.skillAssessment.create({ data: { userId: "does-not-exist", skill: "X", score: 1 } }) }
  catch { rejected = true }
  ok("a foreign key to a nonexistent user is REJECTED by the database", rejected)
} catch (e) {
  console.error("ERROR:", e.message)
  fail++
} finally {
  if (uid) await prisma.user.delete({ where: { id: uid } }).catch(() => {})
  await prisma.$disconnect()
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
