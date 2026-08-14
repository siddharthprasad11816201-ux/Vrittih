/**
 * Apply-gate tests.
 *
 * The rule: a job link is PUBLIC (anyone with the URL can read the posting), but applying
 * requires a signed-in account that is FULLY REGISTERED — verified email plus enough
 * profile for an employer to assess.
 *
 *   node scripts/test-apply-gate.mjs
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gate-"))
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

const reg = load("lib/account/registration.ts")
const prisma = new PrismaClient()
let pass = 0, fail = 0
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + d}`); c ? pass++ : fail++ }
const TAG = "gate-" + Date.now()
const userIds = []
let jobId = null

/* ---------------- the rule, in pure form ---------------- */
const anon = reg.registrationStatus(null)
ok("anonymous is not complete", !anon.complete)
ok("anonymous is told to sign in", anon.summary.toLowerCase().includes("sign in"))
ok("anonymous is not reported as signed in", anon.signedIn === false)
ok("the response is a checklist, not a dead end", anon.requirements.length >= 4)
ok("every unmet step says where to go", anon.requirements.every((r) => !!r.href && !!r.hint))

// Email verification is OFF by default — enforcing it with SMTP unconfigured would lock
// every new user out of applying.
ok("email verification is off unless explicitly switched on", reg.emailVerificationRequired() === false)
const bare = reg.registrationStatus({ id: "u1", name: "A B", email: "a@b.com" })
ok("an unverified account is NOT blocked on verification by default", !bare.missing.includes("email_verified"))
ok("but an empty profile still cannot apply", !bare.complete)
ok("the checklist omits verification when it is off", !bare.requirements.some((r) => r.key === "email_verified"))

// Flip the flag and the requirement reappears with no code change.
process.env.REQUIRE_EMAIL_VERIFICATION = "true"
const enforced = reg.registrationStatus({ id: "u1", name: "A B", emailVerified: null, headline: "h", location: "l", skillCount: 1 })
ok("with the flag on, an unverified account is blocked", !enforced.complete && enforced.missing.includes("email_verified"))
const enforcedOk = reg.registrationStatus({ id: "u1", name: "A B", emailVerified: new Date(), headline: "h", location: "l", skillCount: 1 })
ok("with the flag on, a verified account passes", enforcedOk.complete, JSON.stringify(enforcedOk.missing))
delete process.env.REQUIRE_EMAIL_VERIFICATION

const nameOnly = reg.registrationStatus({ id: "u1", name: "A B" })
ok("a name alone is not enough", !nameOnly.complete)
ok("profile basics are still required", nameOnly.missing.includes("profile_basics"))

const full = reg.registrationStatus({
  id: "u1", name: "Priya Sharma",
  headline: "Backend Engineer", location: "Zurich", skillCount: 3,
})
ok("a verified, completed profile CAN apply", full.complete, JSON.stringify(full.missing))
ok("progress reads 1 when complete", full.progress === 1)

// Any ONE form of evidence is enough — requiring all of them would exclude career changers.
for (const [label, extra] of [
  ["skills", { skillCount: 1 }],
  ["experience", { experienceCount: 1 }],
  ["education", { educationCount: 1 }],
  ["a résumé", { resumeUrl: "/r.pdf" }],
]) {
  const s = reg.registrationStatus({ id: "u", name: "A B", headline: "h", location: "l", ...extra })
  ok(`${label} alone satisfies the evidence requirement`, s.complete, JSON.stringify(s.missing))
}
const noEvidence = reg.registrationStatus({ id: "u", name: "A B", headline: "h", location: "l" })
ok("an empty profile does NOT satisfy it", !noEvidence.complete && noEvidence.missing.includes("evidence"))

// A blank name must not pass as a name.
ok("whitespace is not a name", !reg.registrationStatus({ id: "u", name: "   ", headline: "h", location: "l", skillCount: 1 }).complete)

const blocked = reg.applyBlockedResponse(bare)
ok("the API refusal carries a machine-readable code", blocked.code === "REGISTRATION_INCOMPLETE")
ok("the refusal lists the remaining steps", blocked.registration.steps.length > 0)
ok("anonymous gets a distinct code", reg.applyBlockedResponse(anon).code === "NOT_AUTHENTICATED")

/* ---------------- against the real database ---------------- */
try {
  const employer = await prisma.user.create({ data: { name: "Emp", email: `${TAG}-e@t.local`, password: "x", role: "EMPLOYER" } })
  const seeker = await prisma.user.create({ data: { name: "Seeker", email: `${TAG}-s@t.local`, password: "x", role: "JOBSEEKER" } })
  userIds.push(employer.id, seeker.id)

  const job = await prisma.job.create({
    data: { title: "Public Role", description: "Visible to anyone with the link", company: "TestCo",
            industry: "Technology", location: "Zurich", type: "FULLTIME", postedById: employer.id },
  })
  jobId = job.id

  // A shared link must open without a session.
  const publicRead = await prisma.job.findUnique({ where: { id: job.id }, select: { id: true, title: true, active: true } })
  ok("the posting is readable without any account (shared link works)", !!publicRead && publicRead.active)
  const detailRoute = fs.readFileSync(path.join(ROOT, "app/api/jobs/[id]/route.ts"), "utf8")
  ok("the job-detail API requires no authentication", !detailRoute.includes("Not authenticated"))

  // A fresh account is NOT apply-ready.
  const fresh = await prisma.user.findUnique({
    where: { id: seeker.id },
    select: { id: true, name: true, emailVerified: true, headline: true, location: true, resumeUrl: true,
              _count: { select: { skills: true, experience: true, education: true } } },
  })
  const freshStatus = reg.registrationStatus({
    id: fresh.id, name: fresh.name, emailVerified: fresh.emailVerified, headline: fresh.headline,
    location: fresh.location, resumeUrl: fresh.resumeUrl,
    skillCount: fresh._count.skills, experienceCount: fresh._count.experience, educationCount: fresh._count.education,
  })
  ok("a newly registered account cannot apply yet", !freshStatus.complete)
  ok("it is blocked on the profile, not on email verification", freshStatus.missing.includes("profile_basics") && !freshStatus.missing.includes("email_verified"))

  // Complete the account the way a real user would.
  await prisma.user.update({
    where: { id: seeker.id },
    data: { headline: "Backend Engineer", location: "Zurich" },
  })
  const skill = await prisma.skill.upsert({ where: { name: "Node.js" }, create: { name: "Node.js" }, update: {} })
  await prisma.userSkill.create({ data: { userId: seeker.id, skillId: skill.id } })

  const done = await prisma.user.findUnique({
    where: { id: seeker.id },
    select: { id: true, name: true, emailVerified: true, headline: true, location: true, resumeUrl: true,
              _count: { select: { skills: true, experience: true, education: true } } },
  })
  const doneStatus = reg.registrationStatus({
    id: done.id, name: done.name, emailVerified: done.emailVerified, headline: done.headline,
    location: done.location, resumeUrl: done.resumeUrl,
    skillCount: done._count.skills, experienceCount: done._count.experience, educationCount: done._count.education,
  })
  ok("once the profile is completed, the account can apply", doneStatus.complete, JSON.stringify(doneStatus.missing))

  // The gate is enforced on the SERVER, not merely in the UI.
  const applyRoute = fs.readFileSync(path.join(ROOT, "app/api/applications/route.ts"), "utf8")
  ok("the apply endpoint enforces the gate server-side", applyRoute.includes("registrationStatus") && applyRoute.includes("applyBlockedResponse"))
  ok("it refuses with 403, not a generic 400", /applyBlockedResponse\(reg\), \{ status: 403 \}/.test(applyRoute))
  ok("the gate runs BEFORE the duplicate-application check", applyRoute.indexOf("applyBlockedResponse") < applyRoute.indexOf("Already applied"))

  // Verification must use the hardened OTP machinery, not a new token system.
  const verifyRoute = fs.readFileSync(path.join(ROOT, "app/api/auth/verify-email/route.ts"), "utf8")
  ok("verification reuses the attempt-limited OTP store", verifyRoute.includes("createOtp") && verifyRoute.includes("verifyOtp"))
  ok("the user comes from the session, never the request body", !/body\?\.userId|body\.userId/.test(verifyRoute))
  ok("sending a code is rate limited and fails closed", verifyRoute.includes("failOpen: false"))
} catch (e) {
  console.error("ERROR:", e.message)
  fail++
} finally {
  try {
    if (jobId) await prisma.job.delete({ where: { id: jobId } }).catch(() => {})
    for (const id of userIds) await prisma.user.delete({ where: { id } }).catch(() => {})
  } catch {}
  await prisma.$disconnect()
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
