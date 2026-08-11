/**
 * End-to-end proof of the EduRankAI loop against the REAL local database.
 * Creates a throwaway user + job + test, ranks the candidate BEFORE and AFTER writing
 * assessment evidence, asserts the rank actually rises, then deletes everything it made.
 *
 *   node scripts/test-edurank-e2e.mjs
 *
 * Safe: only touches rows it creates (emails/ids prefixed edurank-e2e-), always cleans up.
 */
import { PrismaClient } from "@prisma/client"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "edurank-e2e-"))
function load(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8")
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText
  const f = path.join(tmp, rel.replace(/[\\/]/g, "__").replace(/\.ts$/, ".cjs"))
  fs.writeFileSync(f, out); return require(f)
}
const { computeMatch, candidateFromUser, jobFromRecord } = load("lib/matching.ts")
const { skillScores } = load("lib/assessment/skillScore.ts")

const prisma = new PrismaClient()
const TAG = "edurank-e2e-" + Date.now()
let pass = 0, fail = 0
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + d}`); c ? pass++ : fail++ }

const made = { userIds: [], jobIds: [], testIds: [], companyIds: [] }

try {
  // --- seed a candidate, an employer, a job requiring 2 skills, and a 2-question test ---
  const employer = await prisma.user.create({ data: { name: "E2E Employer", email: `${TAG}-emp@test.local`, password: "x", role: "EMPLOYER" } })
  const seeker = await prisma.user.create({ data: { name: "E2E Seeker", email: `${TAG}-seek@test.local`, password: "x", role: "JOBSEEKER", headline: "Backend Engineer", location: "Zurich", bio: "Backend developer" } })
  made.userIds.push(employer.id, seeker.id)

  const skillNames = ["Node.js", "PostgreSQL"]
  const skills = []
  for (const name of skillNames) skills.push(await prisma.skill.upsert({ where: { name }, create: { name }, update: {} }))
  for (const s of skills) await prisma.userSkill.create({ data: { userId: seeker.id, skillId: s.id } })

  const job = await prisma.job.create({
    data: {
      title: "Backend Engineer", description: "Build Node.js services on PostgreSQL",
      company: "E2E Co", industry: "Software", location: "Zurich", type: "Full-time", remote: false,
      postedById: employer.id,
      skills: { create: skills.map((s) => ({ skillId: s.id })) },
    },
    include: { skills: { include: { skill: true } } },
  })
  made.jobIds.push(job.id)

  const test = await prisma.test.create({
    data: {
      title: "Backend Skills", type: "SKILL", duration: 30, passingScore: 70, createdById: employer.id,
      questions: {
        create: [
          { type: "MCQ", text: "Node event loop?", correctAnswer: "yes", points: 10, order: 1, skill: "Node.js", difficulty: 4 },
          { type: "MCQ", text: "SQL join?", correctAnswer: "inner", points: 10, order: 2, skill: "PostgreSQL", difficulty: 3 },
        ],
      },
    },
    include: { questions: true },
  })
  made.testIds.push(test.id)

  const loadUser = async () => {
    const u = await prisma.user.findUnique({ where: { id: seeker.id }, include: { skills: { include: { skill: true } }, experience: true, education: true } })
    u.skillAssessments = await prisma.skillAssessment.findMany({ where: { userId: seeker.id } })
    return u
  }

  // --- BEFORE: no assessment evidence ---
  const before = computeMatch(jobFromRecord(job), candidateFromUser(await loadUser()))
  ok("before: no verified skills", before.breakdown.verified === 0 && before.verifiedSkills.length === 0, JSON.stringify(before.breakdown))

  // --- simulate a proctored attempt answered fully correctly, exactly as the submit route does ---
  const attempt = await prisma.testAttempt.create({ data: { testId: test.id, userId: seeker.id, status: "COMPLETED", score: 100, passed: true, proctored: true, completedAt: new Date() } })
  const graded = test.questions.map((q) => ({ skill: q.skill, possible: q.points, earned: q.points, graded: true, difficulty: q.difficulty }))
  const per = skillScores(graded)
  ok("grading produced 2 verified skills @1.0", per.length === 2 && per.every((s) => s.score === 1), JSON.stringify(per))
  for (const s of per) {
    await prisma.skillAssessment.upsert({
      where: { userId_skill: { userId: seeker.id, skill: s.skill } },
      create: { userId: seeker.id, skill: s.skill, score: s.score, proctored: true, difficulty: s.difficulty, attemptId: attempt.id, testId: test.id },
      update: { score: s.score, proctored: true },
    })
  }

  // --- AFTER: the same candidate, now with proctored evidence ---
  const after = computeMatch(jobFromRecord(job), candidateFromUser(await loadUser()))
  ok("after: rank rose", after.score > before.score, `before=${before.score} after=${after.score}`)
  ok("after: both skills verified", after.verifiedSkills.length === 2, JSON.stringify(after.verifiedSkills))
  ok("after: full bonus applied (12)", after.breakdown.verified === 12, String(after.breakdown.verified))
  ok("after: reason explains it", after.reasons.some((r) => /verified by assessment/i.test(r)), JSON.stringify(after.reasons))

  // --- unproctored counts less: same scores, proctored=false -> smaller bonus ---
  for (const s of per) await prisma.skillAssessment.update({ where: { userId_skill: { userId: seeker.id, skill: s.skill } }, data: { proctored: false } })
  const unproctored = computeMatch(jobFromRecord(job), candidateFromUser(await loadUser()))
  ok("unproctored evidence is discounted vs proctored", unproctored.breakdown.verified < after.breakdown.verified && unproctored.breakdown.verified > 0, `unproctored=${unproctored.breakdown.verified} proctored=${after.breakdown.verified}`)
} catch (e) {
  console.error("ERROR:", e.message)
  fail++
} finally {
  // --- cleanup: remove only what this run created ---
  try {
    for (const id of made.testIds) await prisma.test.delete({ where: { id } }).catch(() => {})
    for (const id of made.jobIds) await prisma.job.delete({ where: { id } }).catch(() => {})
    for (const id of made.userIds) {
      await prisma.skillAssessment.deleteMany({ where: { userId: id } }).catch(() => {})
      await prisma.skillProficiency.deleteMany({ where: { userId: id } }).catch(() => {})
      await prisma.user.delete({ where: { id } }).catch(() => {})
    }
  } catch {}
  await prisma.$disconnect()
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
