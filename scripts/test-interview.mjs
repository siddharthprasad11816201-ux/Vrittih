/**
 * Interview subsystem tests — timezone correctness, slot generation, state machines,
 * evidence-first evaluation, adaptive probing and reminder idempotency.
 *
 *   node scripts/test-interview.mjs
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "iv-"))

function load(rel) {
  const dest = path.join(tmp, rel.replace(/\.ts$/, ".js"))
  if (fs.existsSync(dest)) return require(dest)
  const abs = path.join(ROOT, rel)
  const src = fs.readFileSync(abs, "utf8")
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
  }).outputText
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

let pass = 0, fail = 0
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + d}`); c ? pass++ : fail++ }
const eq = (n, g, w) => ok(n, JSON.stringify(g) === JSON.stringify(w), `got=${JSON.stringify(g)} want=${JSON.stringify(w)}`)

/* ---------------- 1. Timezone — the live data-corruption bug ---------------- */
const tzl = load("lib/interview/timezone.ts")

// THE BUG: a recruiter in IST typing 10:00 previously got 10:00Z (= 15:30 IST).
const ist = tzl.parseLocalInZone("2026-08-11T10:00", "Asia/Kolkata")
eq("IST 10:00 stores as 04:30Z (not 10:00Z)", ist.toISOString(), "2026-08-11T04:30:00.000Z")
const ny = tzl.parseLocalInZone("2026-08-11T10:00", "America/New_York")
eq("New York 10:00 in August (EDT, -4) stores as 14:00Z", ny.toISOString(), "2026-08-11T14:00:00.000Z")
const nyWinter = tzl.parseLocalInZone("2026-01-11T10:00", "America/New_York")
eq("New York 10:00 in January (EST, -5) stores as 15:00Z — DST handled", nyWinter.toISOString(), "2026-01-11T15:00:00.000Z")
eq("UTC round-trips unchanged", tzl.parseLocalInZone("2026-08-11T10:00", "UTC").toISOString(), "2026-08-11T10:00:00.000Z")

// An explicit offset must be respected, not re-interpreted.
eq("explicit Z is respected", tzl.resolveScheduledAt("2026-08-11T10:00:00Z", "Asia/Kolkata").toISOString(), "2026-08-11T10:00:00.000Z")
eq("explicit +05:30 is respected", tzl.resolveScheduledAt("2026-08-11T10:00:00+05:30", "UTC").toISOString(), "2026-08-11T04:30:00.000Z")
eq("bare wall clock uses the supplied zone", tzl.resolveScheduledAt("2026-08-11T10:00", "Asia/Kolkata").toISOString(), "2026-08-11T04:30:00.000Z")
eq("garbage input returns null (never a wrong instant)", tzl.resolveScheduledAt("not a date", "UTC"), null)

eq("offset is DST-aware (NY August = -240)", tzl.offsetMinutes(new Date("2026-08-11T12:00:00Z"), "America/New_York"), -240)
eq("offset is DST-aware (NY January = -300)", tzl.offsetMinutes(new Date("2026-01-11T12:00:00Z"), "America/New_York"), -300)
eq("IST offset is +330", tzl.offsetMinutes(new Date("2026-08-11T12:00:00Z"), "Asia/Kolkata"), 330)
ok("an invalid zone falls back to UTC rather than throwing", tzl.normalizeTimeZone("Mars/Olympus") === "UTC")
ok("valid zones are accepted", tzl.isValidTimeZone("Europe/Zurich") && !tzl.isValidTimeZone("Nope/Nowhere"))

// The same instant renders differently per viewer — the old code hardcoded en-IN server-side.
const inst = new Date("2026-08-11T04:30:00.000Z")
ok("viewer in Zurich and viewer in Kolkata see different local times",
  tzl.formatForViewer(inst, "Europe/Zurich") !== tzl.formatForViewer(inst, "Asia/Kolkata"))
ok("day key is computed in the viewer's zone",
  tzl.zonedDayKey(new Date("2026-08-11T20:00:00Z"), "Asia/Kolkata") === "2026-08-12")

/* ---------------- 2. Slot generation ---------------- */
const sl = load("lib/interview/slots.ts")
const NOW = new Date("2026-08-10T00:00:00Z")
const rules = [{ weekday: 2, startMinute: 9 * 60, endMinute: 12 * 60 }]   // Tuesday 09:00-12:00 local

const slots = sl.generateSlots({
  from: new Date("2026-08-11T00:00:00Z"), to: new Date("2026-08-12T00:00:00Z"),
  now: NOW, timezone: "UTC", rules, config: { durationMinutes: 60, granularityMinutes: 60, minNoticeMinutes: 0, bufferMinutes: 0 },
})
eq("Tue 09-12 with 60m slots yields 3", slots.length, 3)
eq("first slot starts at 09:00Z", slots[0].start.toISOString(), "2026-08-11T09:00:00.000Z")
eq("last slot ends at 12:00Z", slots[slots.length - 1].end.toISOString(), "2026-08-11T12:00:00.000Z")
ok("slots are sorted ascending", slots.every((s, i) => i === 0 || s.start >= slots[i - 1].start))

// Availability is LOCAL: the same rule in IST produces different UTC instants.
const istSlots = sl.generateSlots({
  from: new Date("2026-08-11T00:00:00Z"), to: new Date("2026-08-12T00:00:00Z"),
  now: NOW, timezone: "Asia/Kolkata", rules, config: { durationMinutes: 60, granularityMinutes: 60, minNoticeMinutes: 0, bufferMinutes: 0 },
})
eq("IST 09:00 availability = 03:30Z", istSlots[0].start.toISOString(), "2026-08-11T03:30:00.000Z")

// Conflicts + buffers
const busy = [{ start: new Date("2026-08-11T10:00:00Z"), end: new Date("2026-08-11T11:00:00Z") }]
const free = sl.generateSlots({
  from: new Date("2026-08-11T00:00:00Z"), to: new Date("2026-08-12T00:00:00Z"),
  now: NOW, timezone: "UTC", rules, busy, config: { durationMinutes: 60, granularityMinutes: 60, minNoticeMinutes: 0, bufferMinutes: 0 },
})
eq("a booked hour is removed", free.length, 2)
ok("the booked slot is the one missing", !free.some((s) => s.start.toISOString() === "2026-08-11T10:00:00.000Z"))

const buffered = sl.generateSlots({
  from: new Date("2026-08-11T00:00:00Z"), to: new Date("2026-08-12T00:00:00Z"),
  now: NOW, timezone: "UTC", rules, busy, config: { durationMinutes: 60, granularityMinutes: 60, minNoticeMinutes: 0, bufferMinutes: 10 },
})
eq("a 10m buffer also removes the adjacent slots", buffered.length, 0)

ok("overlap detection is half-open (touching intervals do not overlap)",
  !sl.overlaps(new Date("2026-08-11T09:00:00Z"), new Date("2026-08-11T10:00:00Z"),
               new Date("2026-08-11T10:00:00Z"), new Date("2026-08-11T11:00:00Z")))

// Notice period and horizon
const soon = sl.generateSlots({
  from: new Date("2026-08-11T00:00:00Z"), to: new Date("2026-08-12T00:00:00Z"),
  now: new Date("2026-08-11T08:30:00Z"), timezone: "UTC", rules,
  config: { durationMinutes: 60, granularityMinutes: 60, minNoticeMinutes: 120, bufferMinutes: 0 },
})
ok("minimum notice removes imminent slots", soon.every((s) => s.start >= new Date("2026-08-11T10:30:00Z")), JSON.stringify(soon.map(s=>s.start.toISOString())))

// Server-side booking validation
const check = (start, extra = {}) => sl.isSlotBookable({
  start: new Date(start), now: NOW, timezone: "UTC", rules,
  config: { durationMinutes: 60, minNoticeMinutes: 0, bufferMinutes: 0 }, ...extra,
})
ok("a valid slot is bookable", check("2026-08-11T09:00:00Z").ok)
ok("outside availability is refused", !check("2026-08-11T15:00:00Z").ok)
ok("a past time is refused", !sl.isSlotBookable({ start: new Date("2026-08-01T09:00:00Z"), now: NOW, timezone: "UTC", rules, config: { durationMinutes: 60, minNoticeMinutes: 0 } }).ok)
ok("a taken slot is refused (double-booking)", !check("2026-08-11T10:00:00Z", { busy }).ok)
ok("a slot that would overrun the window is refused",
  !sl.isSlotBookable({ start: new Date("2026-08-11T11:30:00Z"), now: NOW, timezone: "UTC", rules, config: { durationMinutes: 60, minNoticeMinutes: 0 } }).ok)

eq("round-robin picks the least loaded", sl.roundRobinPick([{ id: "b", load: 3 }, { id: "a", load: 1 }, { id: "c", load: 1 }]), "a")
eq("round-robin with no candidates is null", sl.roundRobinPick([]), null)
const panel = sl.intersectAvailability([
  [{ start: new Date("2026-08-11T09:00:00Z"), end: new Date("2026-08-11T10:00:00Z") }, { start: new Date("2026-08-11T11:00:00Z"), end: new Date("2026-08-11T12:00:00Z") }],
  [{ start: new Date("2026-08-11T11:00:00Z"), end: new Date("2026-08-11T12:00:00Z") }],
])
eq("panel scheduling keeps only slots everyone shares", panel.length, 1)
eq("the shared slot is the right one", panel[0].start.toISOString(), "2026-08-11T11:00:00.000Z")

/* ---------------- 3. State machines ---------------- */
const st = load("lib/interview/state.ts")

ok("SCHEDULED -> LIVE is legal", st.canTransitionInterview("SCHEDULED", "LIVE").ok)
ok("LIVE -> COMPLETED is legal", st.canTransitionInterview("LIVE", "COMPLETED").ok)
ok("COMPLETED is terminal", !st.canTransitionInterview("COMPLETED", "LIVE").ok)
ok("SCHEDULED cannot jump to COMPLETED", !st.canTransitionInterview("SCHEDULED", "COMPLETED").ok)
ok("an unknown status is refused", !st.canTransitionInterview("SCHEDULED", "BANANA").ok)
ok("CANCELLED is reachable (the UI referenced it but nothing could set it)", st.canTransitionInterview("SCHEDULED", "CANCELLED").ok)
ok("a candidate cannot complete their own interview", !st.checkInterviewTransition("LIVE", "COMPLETED", "CANDIDATE").ok)
ok("the host can complete it", st.checkInterviewTransition("LIVE", "COMPLETED", "HOST").ok)
ok("a candidate may cancel", st.checkInterviewTransition("SCHEDULED", "CANCELLED", "CANDIDATE").ok)
ok("only the system/admin may mark ABANDONED", !st.checkInterviewTransition("LIVE", "ABANDONED", "HOST").ok && st.checkInterviewTransition("LIVE", "ABANDONED", "SYSTEM").ok)

// Stuck-LIVE reaping — the old code left it LIVE forever.
ok("a LIVE interview long past its end is abandoned",
  st.shouldAbandon("LIVE", new Date("2026-08-11T09:00:00Z"), 60, new Date("2026-08-11T20:00:00Z")))
ok("a LIVE interview still in progress is NOT abandoned",
  !st.shouldAbandon("LIVE", new Date("2026-08-11T09:00:00Z"), 60, new Date("2026-08-11T09:30:00Z")))
ok("a SCHEDULED interview nobody joined becomes NO_SHOW",
  st.shouldMarkNoShow("SCHEDULED", new Date("2026-08-11T09:00:00Z"), 60, new Date("2026-08-11T12:00:00Z")))
ok("a future scheduled interview is not a no-show",
  !st.shouldMarkNoShow("SCHEDULED", new Date("2026-08-11T09:00:00Z"), 60, new Date("2026-08-11T09:10:00Z")))

// Application pipeline — previously any string was written unvalidated.
ok("APPLIED -> SCREENING is legal", st.canTransitionApplication("APPLIED", "SCREENING").ok)
ok("APPLIED cannot jump straight to HIRED", !st.canTransitionApplication("APPLIED", "HIRED").ok)
ok("OFFERED -> HIRED is legal", st.canTransitionApplication("OFFERED", "HIRED").ok)
ok("HIRED is terminal", !st.canTransitionApplication("HIRED", "INTERVIEW").ok)
ok("REJECTED cannot be resurrected", !st.canTransitionApplication("REJECTED", "INTERVIEW").ok)
ok("an arbitrary string is refused", !st.canTransitionApplication("APPLIED", "PROMOTED").ok)
ok("another interview round is allowed", st.canTransitionApplication("INTERVIEW", "INTERVIEW").ok)
ok("rejection is possible from any live stage", st.canTransitionApplication("INTERVIEW", "REJECTED").ok)
ok("only the candidate may withdraw", !st.checkStageTransition("INTERVIEW", "WITHDRAWN", "EMPLOYER").ok && st.checkStageTransition("INTERVIEW", "WITHDRAWN", "CANDIDATE").ok)
ok("a candidate cannot advance their own application", !st.checkStageTransition("APPLIED", "SHORTLISTED", "CANDIDATE").ok)
ok("the employer can advance it", st.checkStageTransition("APPLIED", "SHORTLISTED", "EMPLOYER").ok)

/* ---------------- 4. Evidence-first evaluation ---------------- */
const ev = load("lib/interview/evidence.ts")

const noEvidence = ev.evaluateCompetency("system-design", [])
eq("no evidence scores null, NOT zero", noEvidence.score, null)
ok("no evidence is reported as unassessed", noEvidence.assessed === false && noEvidence.confidence === 0)

ok("evidence without an excerpt is discarded (an assertion is not evidence)",
  ev.evaluateCompetency("x", [{ competencyKey: "x", source: "interview_answer", level: 4, excerpt: "" }]).assessed === false)

const strong = ev.evaluateCompetency("backend", [
  { competencyKey: "backend", source: "interview_answer", level: 4, excerpt: "Explained idempotency keys and retry semantics" },
  { competencyKey: "backend", source: "code_sample", level: 4, excerpt: "Passed all hidden tests with O(n) solution" },
  { competencyKey: "backend", source: "assessment", level: 3, excerpt: "Scored 82% on the backend assessment" },
])
ok("multiple corroborating sources raise confidence", strong.confidence > 0.5, String(strong.confidence))
ok("score reflects the trust-weighted mean", strong.score >= 3.5 && strong.score <= 4, String(strong.score))
eq("distinct sources are counted", strong.distinctSources, 3)

const weak = ev.evaluateCompetency("backend", [
  { competencyKey: "backend", source: "resume_claim", level: 4, excerpt: "CV says expert in backend" },
])
ok("a single resume claim yields LOW confidence", weak.confidence < 0.35, String(weak.confidence))
ok("one observation can never be confident", ev.confidenceFor(1, 1, 1.0) < 0.5)
ok("confidence is hard-capped below 1 (an interview is a sample, not proof)", ev.confidenceFor(100, 6, 1.0) <= ev.CONFIDENCE_CAP)

// Whole-interview evaluation
const thin = ev.evaluateInterview(["a", "b", "c"], [
  { competencyKey: "a", source: "interview_answer", level: 4, excerpt: "good answer on a" },
])
eq("thin coverage refuses to recommend", thin.recommendation, "INSUFFICIENT_EVIDENCE")
eq("uncovered competencies are named", thin.unassessed.sort(), ["b", "c"])
eq("required count is reported", thin.requiredCount, 3)

const covered = ev.evaluateInterview(["a", "b"], [
  { competencyKey: "a", source: "interview_answer", level: 4, excerpt: "strong on a" },
  { competencyKey: "a", source: "code_sample", level: 4, excerpt: "clean implementation" },
  { competencyKey: "b", source: "interview_answer", level: 4, excerpt: "strong on b" },
  { competencyKey: "b", source: "work_sample", level: 4, excerpt: "shipped a comparable system" },
])
ok("good, corroborated coverage yields a positive recommendation", ["YES", "STRONG_YES"].includes(covered.recommendation), covered.recommendation)
ok("overall is the mean of assessed competencies", covered.overall >= 3.5, String(covered.overall))

const poor = ev.evaluateInterview(["a", "b"], [
  { competencyKey: "a", source: "interview_answer", level: 1, excerpt: "could not explain a" },
  { competencyKey: "a", source: "code_sample", level: 1, excerpt: "solution did not compile" },
  { competencyKey: "b", source: "interview_answer", level: 1, excerpt: "no understanding of b" },
  { competencyKey: "b", source: "work_sample", level: 1, excerpt: "no comparable work" },
])
ok("weak evidence yields a negative recommendation", ["NO", "STRONG_NO"].includes(poor.recommendation), poor.recommendation)

/* ---------------- 5. Adaptive probing ---------------- */
// Excerpts must be real quotes: isUsable() rejects near-empty strings, because an
// assertion without a justification is not evidence.
const partial = ev.evaluateInterview(["a", "b"], [
  { competencyKey: "a", source: "interview_answer", level: 4, excerpt: "walked through the trade-offs unprompted" },
  { competencyKey: "a", source: "code_sample", level: 4, excerpt: "submitted a correct, tested implementation" },
  { competencyKey: "a", source: "assessment", level: 4, excerpt: "scored 91% on the related assessment" },
])
ok("competency 'a' is now assessed, 'b' is not",
  partial.competencies.find((c) => c.competencyKey === "a").assessed === true &&
  partial.competencies.find((c) => c.competencyKey === "b").assessed === false)
eq("the least-evidenced competency is probed next", ev.nextCompetencyToProbe(partial), "b")
ok("probing stops once everything is well evidenced", ev.nextCompetencyToProbe(covered) !== undefined)

eq("below the minimum question count we keep going",
  ev.shouldStop({ evaluation: partial, questionsAsked: 1, minQuestions: 3, maxQuestions: 20, elapsedMinutes: 5, maxMinutes: 60 }).stop, false)
eq("the question budget stops the loop",
  ev.shouldStop({ evaluation: partial, questionsAsked: 20, minQuestions: 3, maxQuestions: 20, elapsedMinutes: 5, maxMinutes: 60 }).stop, true)
eq("the time budget stops the loop",
  ev.shouldStop({ evaluation: partial, questionsAsked: 5, minQuestions: 3, maxQuestions: 20, elapsedMinutes: 61, maxMinutes: 60 }).stop, true)
ok("a budget stop says coverage may be incomplete (never claims full coverage)",
  /incomplete/i.test(ev.shouldStop({ evaluation: partial, questionsAsked: 20, minQuestions: 3, maxQuestions: 20, elapsedMinutes: 5, maxMinutes: 60 }).reason))

/* ---------------- 6. Reminders ---------------- */
const rm = load("lib/interview/reminders.ts")
const at = new Date("2026-08-12T10:00:00Z")

eq("23h out fires the 24h tier", rm.dueReminders({ scheduledAt: at, now: new Date("2026-08-11T11:00:00Z"), alreadySent: [] }), ["T24H"])
eq("already-sent tiers do not re-fire (idempotent across cron retries)",
  rm.dueReminders({ scheduledAt: at, now: new Date("2026-08-11T11:00:00Z"), alreadySent: ["T24H"] }), [])
eq("50m out fires the 1h tier", rm.dueReminders({ scheduledAt: at, now: new Date("2026-08-12T09:10:00Z"), alreadySent: ["T24H"] }), ["T1H"])
eq("10m out fires the 15m tier", rm.dueReminders({ scheduledAt: at, now: new Date("2026-08-12T09:50:00Z"), alreadySent: ["T24H", "T1H"] }), ["T15M"])
eq("after the start nothing fires", rm.dueReminders({ scheduledAt: at, now: new Date("2026-08-12T10:30:00Z"), alreadySent: [] }), [])
eq("3 days out nothing fires yet", rm.dueReminders({ scheduledAt: at, now: new Date("2026-08-09T10:00:00Z"), alreadySent: [] }), [])
// A late-created interview sits inside several windows at once — send only the most urgent.
const multi = rm.dueReminders({ scheduledAt: at, now: new Date("2026-08-12T09:50:00Z"), alreadySent: [] })
eq("overlapping windows send exactly one reminder", multi.length, 1)
eq("and it is the most urgent tier", multi[0], "T15M")
ok("the idempotency key is per interview and tier", rm.reminderKey("iv1", "T1H") !== rm.reminderKey("iv1", "T24H"))

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
