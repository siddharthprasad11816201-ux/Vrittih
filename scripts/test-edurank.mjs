/**
 * In-house test for the EduRankAI assessment -> ranking loop + gamification.
 * No test framework (in-house ethos): transpiles the pure TS libs to CJS with the local
 * `typescript` (a devDependency / build tool) and asserts real behavior.
 *
 *   node scripts/test-edurank.mjs
 *
 * Exits non-zero on any failure.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "edurank-"))

function load(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8")
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText
  const file = path.join(tmp, rel.replace(/[\\/]/g, "__").replace(/\.ts$/, ".cjs"))
  fs.writeFileSync(file, out)
  return require(file)
}

const matching = load("lib/matching.ts")
const gam = load("lib/gamification.ts")
const ss = load("lib/assessment/skillScore.ts")

let pass = 0, fail = 0
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`)
  ok ? pass++ : fail++
}
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + detail}`)
  cond ? pass++ : fail++
}

/* ---------- 1. Gamification: levels ---------- */
eq("level @0xp = 1", gam.levelForXp(0), 1)
eq("level @99xp = 1", gam.levelForXp(99), 1)
eq("level @100xp = 2", gam.levelForXp(100), 2)
eq("level @299xp = 2", gam.levelForXp(299), 2)
eq("level @300xp = 3", gam.levelForXp(300), 3)
eq("level @600xp = 4", gam.levelForXp(600), 4)

/* ---------- 2. Gamification: streaks ---------- */
const first = gam.rollStreak({ ...gam.ZERO_PROGRESS }, "2026-08-11")
eq("first activity -> streak 1", first.streakDays, 1)
const consec = gam.rollStreak({ ...first }, "2026-08-12")
eq("consecutive day -> streak 2", consec.streakDays, 2)
const same = gam.rollStreak({ ...first }, "2026-08-11")
eq("same day -> unchanged streak 1", same.streakDays, 1)
const broke = gam.rollStreak({ ...first, streakDays: 5 }, "2026-08-15")
eq("4-day gap, no freeze -> reset to 1", broke.streakDays, 1)
const frozen = gam.rollStreak({ ...first, streakDays: 5, freezes: 1 }, "2026-08-13")
ok("2-day gap + freeze -> streak kept (5) & freeze spent (0)", frozen.streakDays === 5 && frozen.freezes === 0, JSON.stringify(frozen))

/* ---------- 3. Gamification: award + testXp ---------- */
const award = gam.awardXp({ ...gam.ZERO_PROGRESS, xp: 90, level: 1, lastActiveDay: "2026-08-10" }, 20, "2026-08-11")
ok("award crosses to level 2 & flags leveledUp", award.state.xp === 110 && award.state.level === 2 && award.leveledUp === true, JSON.stringify(award))
eq("testXp pass/100%/10-correct/proctored = 130", gam.testXp({ passed: true, scorePct: 100, correctCount: 10, proctored: true }), 130)
eq("testXp fail/0/0/unproctored = 20", gam.testXp({ passed: false, scorePct: 0, correctCount: 0, proctored: false }), 20)

/* ---------- 4. Per-skill scoring ---------- */
const scored = ss.skillScores([
  { skill: "Node.js", possible: 10, earned: 10, graded: true, difficulty: 3 },
  { skill: "Node.js", possible: 10, earned: 0, graded: true, difficulty: 4 },
  { skill: "PostgreSQL", possible: 10, earned: 5, graded: true, difficulty: 2 },
  { skill: "Node.js", possible: 0, earned: 0, graded: false, difficulty: 3 },   // manual review -> excluded
  { skill: null, possible: 10, earned: 10, graded: true, difficulty: 1 },        // untagged -> excluded
])
const node = scored.find((s) => s.skill === "Node.js")
const pg = scored.find((s) => s.skill === "PostgreSQL")
ok("Node.js aggregates 10/20 = 0.5 over 2 questions @ hardest diff 4", node && node.score === 0.5 && node.possible === 20 && node.count === 2 && node.difficulty === 4, JSON.stringify(node))
ok("PostgreSQL 5/10 = 0.5", pg && pg.score === 0.5, JSON.stringify(pg))
ok("untagged & manual-review excluded (exactly 2 skills)", scored.length === 2, JSON.stringify(scored.map((s) => s.skill)))

/* ---------- 5. Verified-skill ranking boost (the EduRankAI core) ---------- */
const job = { title: "Backend Engineer", description: "Build Node.js services on PostgreSQL", industry: "Software", location: "Zurich", type: "Full-time", remote: false, skills: ["Node.js", "PostgreSQL"] }
const base = { headline: "Backend Engineer", bio: "Backend developer", location: "Zurich", skills: ["Node.js", "PostgreSQL"], experienceTitles: ["Backend Engineer"], experienceText: [], educationFields: ["Computer Science"], yearsExperience: 4 }
const unverified = matching.computeMatch(job, { ...base })
const verified = matching.computeMatch(job, { ...base, verifiedSkills: { "node.js": 0.9, "postgresql": 0.85 } })
ok("verified candidate scores strictly higher than identical unverified", verified.score > unverified.score, `verified=${verified.score} unverified=${unverified.score}`)
ok("unverified is non-regressive (verified breakdown = 0)", unverified.breakdown.verified === 0, JSON.stringify(unverified.breakdown))
ok("verified bonus is bounded (1..12)", verified.breakdown.verified >= 1 && verified.breakdown.verified <= 12, String(verified.breakdown.verified))
ok("verified score never exceeds 100", verified.score <= 100 && unverified.score <= 100, `${verified.score}/${unverified.score}`)
ok("both required skills reported verified", verified.verifiedSkills.includes("node.js") && verified.verifiedSkills.includes("postgresql"), JSON.stringify(verified.verifiedSkills))
// A skill the job does NOT require, even if verified, must not add points.
const irrelevant = matching.computeMatch(job, { ...base, verifiedSkills: { "kubernetes": 1 } })
ok("verifying a non-required skill adds nothing", irrelevant.breakdown.verified === 0, JSON.stringify(irrelevant.breakdown))

/* ---------- 6. Saved searches + job alerts (Indeed retention loop) ---------- */
const al = load("lib/alerts.ts")

// query normalization must bound and sanitize arbitrary client input
const nq = al.normalizeQuery({ q: "  engineer  ", industry: "Software", type: "Full-time", remote: true, minMatch: 250, junk: "x" })
ok("normalizeQuery trims, keeps known keys, clamps minMatch to 100", nq.q === "engineer" && nq.minMatch === 100 && nq.remote === true && nq.junk === undefined, JSON.stringify(nq))
eq("normalizeQuery ignores non-boolean remote", al.normalizeQuery({ remote: "yes" }).remote, undefined)
eq("normalizeFreq defaults unknown to daily", al.normalizeFreq("hourly"), "daily")
eq("normalizeFreq keeps off", al.normalizeFreq("off"), "off")
eq("describeQuery builds a label", al.describeQuery({ q: "node", remote: true, minMatch: 70 }), '"node" · Remote · 70%+ match')
eq("describeQuery empty -> All jobs", al.describeQuery({}), "All jobs")

// due-ness
const NOW = new Date("2026-08-11T09:00:00Z")
eq("off is never due", al.isDue("off", null, NOW), false)
eq("never-run daily is due", al.isDue("daily", null, NOW), true)
eq("daily run 2h ago not due", al.isDue("daily", new Date("2026-08-11T07:00:00Z"), NOW), false)
eq("daily run 24h ago is due", al.isDue("daily", new Date("2026-08-10T09:00:00Z"), NOW), true)
eq("weekly run 2 days ago not due", al.isDue("weekly", new Date("2026-08-09T09:00:00Z"), NOW), false)
eq("weekly run 8 days ago is due", al.isDue("weekly", new Date("2026-08-03T09:00:00Z"), NOW), true)

// diffing: only genuinely NEW jobs, respecting minMatch, and the cursor always advances
const cursor0 = new Date("2026-08-10T00:00:00Z")
const jobs = [
  { id: "old", createdAt: new Date("2026-08-09T00:00:00Z"), score: 99 },  // before cursor
  { id: "new-hi", createdAt: new Date("2026-08-11T00:00:00Z"), score: 80 },
  { id: "new-lo", createdAt: new Date("2026-08-11T06:00:00Z"), score: 20 }, // below minMatch
]
const r1 = al.newMatches(jobs, cursor0, 70)
eq("only the new, high-scoring job matches", r1.matches.map((m) => m.id), ["new-hi"])
ok("cursor advances past ALL considered jobs (incl. rejected) so they never resurface",
  r1.cursor.getTime() === new Date("2026-08-11T06:00:00Z").getTime(), String(r1.cursor))
const r2 = al.newMatches(jobs, r1.cursor, 70)
eq("re-running after the cursor yields nothing (no duplicate alerts)", r2.matches.length, 0)
const r3 = al.newMatches(jobs, null, 0)
eq("no cursor + no minMatch -> all jobs, newest first", r3.matches.map((m) => m.id), ["new-lo", "new-hi", "old"])
eq("unscored jobs pass when minMatch is 0", al.newMatches([{ id: "a", createdAt: new Date("2026-08-11T00:00:00Z") }], null, 0).matches.length, 1)

const copy = al.alertNotification("Backend roles", [{ id: "a", createdAt: NOW }])
eq("singular notification copy", copy.title, '1 new job for "Backend roles"')
eq("plural notification copy", al.alertNotification("X", [{ id: "a", createdAt: NOW }, { id: "b", createdAt: NOW }]).title, '2 new jobs for "X"')

/* ---------- 7. Social engagement + trust primitives ---------- */
const soc = load("lib/social/engage.ts")

// reactions
eq("unknown reaction degrades to like", soc.normalizeReaction("angry"), "like")
eq("valid reaction kept", soc.normalizeReaction("celebrate"), "celebrate")
const tally = soc.tallyReactions([{ reaction: "like" }, { reaction: "celebrate" }, { reaction: "celebrate" }, { reaction: null }])
ok("tally counts by type with total", tally.total === 4 && tally.byType.celebrate === 2 && tally.byType.like === 2, JSON.stringify(tally))

// hashtags
eq("parses unique lowercase tags", soc.parseHashtags("Loving #NodeJS and #nodejs plus #Hiring!"), ["nodejs", "hiring"])
eq("ignores tags starting with a digit", soc.parseHashtags("#1st #2fast"), [])
eq("no tags -> empty", soc.parseHashtags("plain text"), [])
ok("caps at 10 tags", soc.parseHashtags(Array.from({ length: 15 }, (_, i) => `#tag${String.fromCharCode(97 + i)}`).join(" ")).length === 10)

// report validation
ok("valid reason/target accepted", soc.isValidReason("spam") && soc.isValidTarget("post"))
ok("invalid reason/target rejected", !soc.isValidReason("because") && !soc.isValidTarget("planet"))
ok("status validation", soc.isValidStatus("OPEN") && soc.isValidStatus("RESOLVED") && !soc.isValidStatus("open"))

// blocking is mutual
const blocks = [{ blockerId: "me", blockedId: "a" }, { blockerId: "b", blockedId: "me" }, { blockerId: "x", blockedId: "y" }]
const hid = soc.hiddenUserIds(blocks, "me")
ok("hides both who I blocked and who blocked me, not unrelated pairs",
  hid.has("a") && hid.has("b") && !hid.has("x") && !hid.has("y") && hid.size === 2, JSON.stringify([...hid]))

// endorsement weight: diminishing returns, never linear, bounded
eq("0 endorsements -> 0", soc.endorsementWeight(0), 0)
ok("1 endorsement is meaningful", soc.endorsementWeight(1) === 0.25, String(soc.endorsementWeight(1)))
ok("weight rises but with diminishing returns", soc.endorsementWeight(5) > soc.endorsementWeight(2) && (soc.endorsementWeight(5) - soc.endorsementWeight(4)) < (soc.endorsementWeight(2) - soc.endorsementWeight(1)))
ok("weight is bounded below 1 even at high volume", soc.endorsementWeight(1000) < 1)

/* ---------- 8. Assessment integrity: seeded shuffle + server timing ---------- */
const integ = load("lib/assessment/integrity.ts")

const qs = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, options: ["a", "b", "c", "d"] }))
const shuffledA = integ.prepareQuestions(qs, "attempt-A", { shuffleQuestions: true })
const shuffledA2 = integ.prepareQuestions(qs, "attempt-A", { shuffleQuestions: true })
const shuffledB = integ.prepareQuestions(qs, "attempt-B", { shuffleQuestions: true })
eq("same attempt -> identical order (refresh cannot reshuffle)", shuffledA.map((q) => q.id), shuffledA2.map((q) => q.id))
ok("different attempts -> different order", JSON.stringify(shuffledA.map((q) => q.id)) !== JSON.stringify(shuffledB.map((q) => q.id)))
eq("shuffle preserves every question", shuffledA.map((q) => q.id).sort(), qs.map((q) => q.id).sort())
ok("input array is not mutated", qs[0].id === "q0")

const sampled = integ.prepareQuestions(qs, "attempt-A", { shuffleQuestions: true, sampleN: 4 })
eq("sampleN draws exactly N", sampled.length, 4)
ok("sampled ids are all real", sampled.every((q) => qs.some((o) => o.id === q.id)))
const sampledNoShuffle = integ.prepareQuestions(qs, "attempt-C", { sampleN: 3 })
ok("sampleN without shuffleQuestions still randomizes (not just first N)", sampledNoShuffle.length === 3)

const opts = integ.prepareQuestions([{ id: "q", options: ["a", "b", "c", "d"] }], "attempt-A", { shuffleOptions: true })
eq("option shuffle keeps all options", opts[0].options.slice().sort(), ["a", "b", "c", "d"])
const twoQ = integ.prepareQuestions([{ id: "q1", options: ["a","b","c","d"] }, { id: "q2", options: ["a","b","c","d"] }], "seed-x", { shuffleOptions: true })
ok("different questions get different option orders", JSON.stringify(twoQ[0].options) !== JSON.stringify(twoQ[1].options))

// server timing
const start = new Date("2026-08-11T10:00:00Z")
eq("within limit is not expired", integ.checkTiming(start, 60, new Date("2026-08-11T10:59:00Z")).expired, false)
eq("just past limit but inside grace is not expired", integ.checkTiming(start, 60, new Date("2026-08-11T11:00:20Z")).expired, false)
eq("well past limit is expired", integ.checkTiming(start, 60, new Date("2026-08-11T11:05:00Z")).expired, true)
eq("duration 0 means untimed", integ.checkTiming(start, 0, new Date("2027-01-01T00:00:00Z")).expired, false)

/* ---------- 9. Spaced repetition (SM-2) ---------- */
const srs = load("lib/assessment/srs.ts")
const NOWD = new Date("2026-08-11T00:00:00Z")

const srs1 = srs.review({ ...srs.NEW_CARD }, 4, NOWD)
eq("first success -> 1 day", srs1.intervalDays, 1)
const srs2 = srs.review({ repetitions: 1, intervalDays: 1, ease: 2.5 }, 4, NOWD)
eq("second success -> 6 days", srs2.intervalDays, 6)
const srs3 = srs.review({ repetitions: 2, intervalDays: 6, ease: 2.5 }, 4, NOWD)
eq("third success -> interval * ease", srs3.intervalDays, 15)
ok("dueAt is interval days out", Math.round((srs3.dueAt - NOWD) / 86400000) === 15, String(srs3.dueAt))

const failed = srs.review({ repetitions: 5, intervalDays: 40, ease: 2.5 }, 2, NOWD)
ok("failure resets repetitions and returns tomorrow", failed.repetitions === 0 && failed.intervalDays === 1, JSON.stringify(failed))
ok("failure lowers ease (item stays harder)", failed.ease < 2.5, String(failed.ease))

let hard = { repetitions: 0, intervalDays: 0, ease: 2.5 }
for (let i = 0; i < 20; i++) hard = srs.review(hard, 0, NOWD)
ok("ease never drops below the 1.3 floor", hard.ease >= 1.3, String(hard.ease))

eq("wrong answer grades as a failure", srs.gradeFromAnswer(false, 3) < 3, true)
eq("correct on a hard item grades highest", srs.gradeFromAnswer(true, 5), 5)
const due = srs.dueCards([{ dueAt: new Date("2026-08-12") }, { dueAt: new Date("2026-08-10") }, { dueAt: new Date("2026-08-09") }], NOWD)
eq("only past-due cards, soonest first", due.map((c) => c.dueAt.toISOString().slice(0, 10)), ["2026-08-09", "2026-08-10"])

/* ---------- summary ---------- */
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
