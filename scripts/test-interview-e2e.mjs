/**
 * End-to-end interview pipeline against the REAL database:
 *   availability -> slots -> booking -> conflict rejection -> lifecycle -> consent
 *   -> evidence -> evaluation -> human decision -> reminder idempotency
 *
 *   node scripts/test-interview-e2e.mjs
 *
 * Creates only rows it tags, and always cleans up.
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ive2e-"))
function load(rel) {
  const dest = path.join(tmp, rel.replace(/\.ts$/, ".js"))
  if (fs.existsSync(dest)) return require(dest)
  const abs = path.join(ROOT, rel)
  const src = fs.readFileSync(abs, "utf8")
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true } }).outputText
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, out)
  for (const m of src.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const depRel = path.relative(ROOT, path.resolve(path.dirname(abs), m[1])).replace(/\\/g, "/")
    for (const cand of [`${depRel}.ts`, `${depRel}/index.ts`]) {
      if (fs.existsSync(path.join(ROOT, cand))) { load(cand); break }
    }
  }
  return require(dest)
}
const slots = load("lib/interview/slots.ts")
const state = load("lib/interview/state.ts")
const evid = load("lib/interview/evidence.ts")
const rem = load("lib/interview/reminders.ts")

const prisma = new PrismaClient()
const TAG = "iv-e2e-" + Date.now()
let pass = 0, fail = 0
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + d}`); c ? pass++ : fail++ }
const userIds = []
let planId = null

try {
  const host = await prisma.user.create({ data: { name: "Interviewer", email: `${TAG}-h@t.local`, password: "x", role: "EMPLOYER", timezone: "Europe/Zurich" } })
  const cand = await prisma.user.create({ data: { name: "Candidate", email: `${TAG}-c@t.local`, password: "x", role: "JOBSEEKER", timezone: "Asia/Kolkata" } })
  userIds.push(host.id, cand.id)

  // ---- availability: Tuesdays 09:00–12:00 Zurich ----
  await prisma.availabilityRule.create({ data: { userId: host.id, weekday: 2, startMinute: 540, endMinute: 720, timezone: "Europe/Zurich" } })
  const rules = await prisma.availabilityRule.findMany({ where: { userId: host.id } })
  ok("availability rule persisted", rules.length === 1 && rules[0].weekday === 2)

  // ---- slot generation from real rows ----
  const NOW = new Date("2026-08-10T00:00:00Z")
  const gen = slots.generateSlots({
    from: new Date("2026-08-11T00:00:00Z"), to: new Date("2026-08-12T00:00:00Z"),
    now: NOW, timezone: "Europe/Zurich",
    rules: rules.map((r) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute })),
    busy: [], config: { durationMinutes: 60, granularityMinutes: 60, minNoticeMinutes: 0, bufferMinutes: 0 },
  })
  ok("slots generated from persisted availability", gen.length === 3, String(gen.length))
  // Zurich is UTC+2 in August, so 09:00 local = 07:00Z.
  ok("slots are in the interviewer's LOCAL clock (09:00 Zurich = 07:00Z)",
    gen[0].start.toISOString() === "2026-08-11T07:00:00.000Z", gen[0].start.toISOString())

  // ---- booking ----
  const start = gen[0].start
  const iv = await prisma.interview.create({
    data: {
      title: "Backend interview", type: "ONE_ON_ONE", status: "SCHEDULED",
      scheduledAt: start, timezone: "Europe/Zurich", duration: 60,
      hostId: host.id, roomCode: `${TAG}-ROOM`,
      participants: { create: [{ userId: host.id, role: "HOST" }, { userId: cand.id, role: "CANDIDATE" }] },
    },
  })
  ok("interview booked with a canonical UTC instant + its zone", iv.scheduledAt.toISOString() === start.toISOString() && iv.timezone === "Europe/Zurich")

  // ---- the booked slot is no longer offered ----
  const busy = (await prisma.interview.findMany({ where: { hostId: host.id, status: { in: ["SCHEDULED", "LIVE"] } }, select: { scheduledAt: true, duration: true } }))
    .map((i) => ({ start: i.scheduledAt, end: new Date(i.scheduledAt.getTime() + i.duration * 60000) }))
  const after = slots.generateSlots({
    from: new Date("2026-08-11T00:00:00Z"), to: new Date("2026-08-12T00:00:00Z"),
    now: NOW, timezone: "Europe/Zurich",
    rules: rules.map((r) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute })),
    busy, config: { durationMinutes: 60, granularityMinutes: 60, minNoticeMinutes: 0, bufferMinutes: 0 },
  })
  ok("the booked slot disappears from availability", after.length === 2 && !after.some((s) => s.start.getTime() === start.getTime()))
  ok("double-booking the same slot is refused server-side",
    !slots.isSlotBookable({ start, now: NOW, timezone: "Europe/Zurich", rules: rules.map((r) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute })), busy, config: { durationMinutes: 60, minNoticeMinutes: 0 } }).ok)

  // ---- lifecycle, server-authoritative ----
  ok("candidate cannot complete the interview", !state.checkInterviewTransition("SCHEDULED", "COMPLETED", "CANDIDATE").ok)
  ok("SCHEDULED cannot jump to COMPLETED even for the host", !state.checkInterviewTransition("SCHEDULED", "COMPLETED", "HOST").ok)
  await prisma.interview.update({ where: { id: iv.id }, data: { status: "LIVE" } })
  const live = await prisma.interview.findUnique({ where: { id: iv.id }, select: { status: true } })
  ok("interview moved to LIVE", live.status === "LIVE")
  ok("LIVE -> COMPLETED is allowed for the host", state.checkInterviewTransition("LIVE", "COMPLETED", "HOST").ok)

  // ---- consent must exist before recording ----
  const before = await prisma.interviewConsent.count({ where: { interviewId: iv.id, scope: "recording", granted: true } })
  ok("no consent row means no consent (absence is not permission)", before === 0)
  await prisma.interviewConsent.create({ data: { interviewId: iv.id, userId: cand.id, scope: "recording", granted: true, grantedAt: new Date() } })
  const consented = await prisma.interviewConsent.count({ where: { interviewId: iv.id, scope: "recording", granted: true } })
  ok("consent is recorded per (interview, user, scope)", consented === 1)
  let dupBlocked = false
  try { await prisma.interviewConsent.create({ data: { interviewId: iv.id, userId: cand.id, scope: "recording", granted: true } }) } catch { dupBlocked = true }
  ok("duplicate consent rows are prevented by the unique constraint", dupBlocked)

  // ---- plan defines what must be covered ----
  const plan = await prisma.interviewPlan.create({
    data: { createdById: host.id, title: "Backend loop", competencies: JSON.stringify(["software-engineering", "system-design"]) },
  })
  planId = plan.id
  await prisma.interview.update({ where: { id: iv.id }, data: { planId: plan.id } })

  // ---- evidence -> evaluation ----
  await prisma.interviewEvidence.createMany({
    data: [
      { interviewId: iv.id, competencyKey: "software-engineering", source: "interview_answer", level: 4, excerpt: "Explained idempotency keys and retry semantics unprompted", recordedById: host.id },
      { interviewId: iv.id, competencyKey: "software-engineering", source: "code_sample", level: 4, excerpt: "Passed all hidden tests with a clean O(n) solution", recordedById: host.id },
    ],
  })
  let rows = await prisma.interviewEvidence.findMany({ where: { interviewId: iv.id } })
  let evaluation = evid.evaluateInterview(JSON.parse(plan.competencies), rows.map((r) => ({ competencyKey: r.competencyKey, source: r.source, level: r.level, excerpt: r.excerpt })))
  ok("partial coverage refuses to recommend", evaluation.recommendation === "INSUFFICIENT_EVIDENCE", evaluation.recommendation)
  ok("the uncovered competency is named", evaluation.unassessed.includes("system-design"), JSON.stringify(evaluation.unassessed))
  ok("adaptive loop probes the uncovered competency next", evid.nextCompetencyToProbe(evaluation) === "system-design")

  await prisma.interviewEvidence.createMany({
    data: [
      { interviewId: iv.id, competencyKey: "system-design", source: "interview_answer", level: 4, excerpt: "Designed a sharded queue with backpressure and justified the trade-offs", recordedById: host.id },
      { interviewId: iv.id, competencyKey: "system-design", source: "work_sample", level: 4, excerpt: "Shipped a comparable ingestion pipeline at scale", recordedById: host.id },
    ],
  })
  rows = await prisma.interviewEvidence.findMany({ where: { interviewId: iv.id } })
  evaluation = evid.evaluateInterview(JSON.parse(plan.competencies), rows.map((r) => ({ competencyKey: r.competencyKey, source: r.source, level: r.level, excerpt: r.excerpt })))
  ok("full, corroborated coverage yields a real recommendation", ["YES", "STRONG_YES"].includes(evaluation.recommendation), evaluation.recommendation)
  ok("every competency traces back to quoted evidence",
    evaluation.competencies.every((c) => !c.assessed || c.excerpts.length > 0))

  const stored = await prisma.interviewEvaluation.create({
    data: {
      interviewId: iv.id, competenciesJson: JSON.stringify(evaluation.competencies),
      overall: evaluation.overall, confidence: evaluation.overallConfidence, recommendation: evaluation.recommendation,
    },
  })
  ok("evaluation persisted WITHOUT a human decision (AI recommends, human decides)", stored.humanDecision === null)
  const decided = await prisma.interviewEvaluation.update({ where: { interviewId: iv.id }, data: { humanDecision: "ADVANCE", humanReviewedById: host.id, decidedAt: new Date() } })
  ok("a human decision is recorded separately and attributed", decided.humanDecision === "ADVANCE" && decided.humanReviewedById === host.id)

  // ---- reminder idempotency against the stored column ----
  const fresh = await prisma.interview.findUnique({ where: { id: iv.id }, select: { remindersSent: true } })
  ok("remindersSent starts empty", fresh.remindersSent === "[]")
  const at = new Date(Date.now() + 23 * 3600 * 1000)
  const due1 = rem.dueReminders({ scheduledAt: at, now: new Date(), alreadySent: JSON.parse(fresh.remindersSent) })
  ok("the 24h tier is due", due1.length === 1 && due1[0] === "T24H")
  await prisma.interview.update({ where: { id: iv.id }, data: { remindersSent: JSON.stringify(due1) } })
  const again = await prisma.interview.findUnique({ where: { id: iv.id }, select: { remindersSent: true } })
  const due2 = rem.dueReminders({ scheduledAt: at, now: new Date(), alreadySent: JSON.parse(again.remindersSent) })
  ok("a re-run sends nothing (cron retries cannot double-notify)", due2.length === 0)

  // ---- application pipeline guard ----
  ok("APPLIED cannot jump to HIRED", !state.canTransitionApplication("APPLIED", "HIRED").ok)
  ok("OFFERED -> HIRED is allowed", state.canTransitionApplication("OFFERED", "HIRED").ok)
} catch (e) {
  console.error("ERROR:", e.message)
  fail++
} finally {
  try {
    for (const id of userIds) {
      const ivs = await prisma.interview.findMany({ where: { hostId: id }, select: { id: true } }).catch(() => [])
      for (const x of ivs) {
        await prisma.interviewEvaluation.deleteMany({ where: { interviewId: x.id } }).catch(() => {})
        await prisma.interview.delete({ where: { id: x.id } }).catch(() => {})
      }
      await prisma.availabilityRule.deleteMany({ where: { userId: id } }).catch(() => {})
      await prisma.availabilityException.deleteMany({ where: { userId: id } }).catch(() => {})
    }
    if (planId) await prisma.interviewPlan.delete({ where: { id: planId } }).catch(() => {})
    for (const id of userIds) await prisma.user.delete({ where: { id } }).catch(() => {})
  } catch {}
  await prisma.$disconnect()
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
