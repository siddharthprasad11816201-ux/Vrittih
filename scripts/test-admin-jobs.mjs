/**
 * Admin job-control authorization tests against the REAL database.
 *
 *   node scripts/test-admin-jobs.mjs
 *
 * The point: hiding a button is not authorization. These assert the SERVER refuses the
 * action, so a non-admin calling the API directly gets nothing — and that archived
 * postings stay invisible to ordinary users even if they pass ?includeArchived=true.
 *
 * Route handlers are invoked directly with a forged cookie, so the checks exercise the
 * real code path rather than a re-implementation of it.
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
// The harness tree lives INSIDE the project so Node's normal upward node_modules lookup
// resolves real dependencies (zod, @prisma/client) exactly as the app does. A tree in the
// OS temp dir cannot see them.
const tmp = fs.mkdtempSync(path.join(ROOT, ".harness-"))
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_for_security_suite_only"

// Minimal next/server shim — the handlers only use NextResponse.json.
fs.writeFileSync(
  path.join(tmp, "next-server-shim.cjs"),
  [
    "exports.NextResponse = {",
    "  json: (body, init) => ({",
    "    status: (init && init.status) || 200,",
    "    headers: (init && init.headers) || {},",
    "    json: async () => body,",
    "  }),",
    "}",
  ].join("\n"),
)
// Shared Prisma client so the routes hit the same database these assertions read.
fs.writeFileSync(path.join(tmp, "prisma-shim.cjs"), "module.exports = { prisma: global.__testPrisma }")

const SHIM_NEXT = path.join(tmp, "next-server-shim.cjs").replace(/\\/g, "/")
const SHIM_PRISMA = path.join(tmp, "prisma-shim.cjs").replace(/\\/g, "/")

/**
 * Transpile a module, rewriting the specifiers Node cannot resolve outside Next:
 * `next/server` to a shim, `@/lib/prisma` to the shared client, and other `@/` aliases to
 * the real transpiled files. This lets the tests call the ACTUAL route handlers rather
 * than a re-implementation that could drift from them.
 */
function load(rel) {
  const dest = path.join(tmp, rel.replace(/\.tsx?$/, ".js"))
  if (fs.existsSync(dest)) return require(dest)

  const abs = path.join(ROOT, rel)
  let src = fs.readFileSync(abs, "utf8")
  const deps = []

  const tryResolve = (base) => {
    for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      if (fs.existsSync(path.join(ROOT, cand))) return cand
    }
    return null
  }
  const rewrite = (prefix, spec) => {
    if (spec === "next/server") return `${prefix}"${SHIM_NEXT}"`
    if (spec === "@/lib/prisma") return `${prefix}"${SHIM_PRISMA}"`
    if (spec.startsWith("@/")) {
      const cand = tryResolve(spec.slice(2))
      if (!cand) return `${prefix}"${spec}"`
      deps.push(cand)
      return `${prefix}"${path.join(tmp, cand.replace(/\.tsx?$/, ".js")).replace(/\\/g, "/")}"`
    }
    if (spec.startsWith(".")) {
      // Relative specifiers keep their text — the temp tree mirrors the real one — but the
      // dependency still has to be materialised first.
      const base = path.relative(ROOT, path.resolve(path.dirname(abs), spec)).replace(/\\/g, "/")
      const cand = tryResolve(base)
      if (cand) deps.push(cand)
      return `${prefix}"${spec}"`
    }
    return `${prefix}"${spec}"`
  }

  // `from "x"` covers import/export-from. A bare `import "x"` (side-effect only, used by
  // the AIOS provider registry) has no `from` and was previously missed entirely.
  src = src.replace(/from\s+["']([^"']+)["']/g, (_f, spec) => rewrite("from ", spec))
  src = src.replace(/(^|\n)(\s*)import\s+["']([^"']+)["']/g, (_f, nl, indent, spec) => `${nl}${indent}${rewrite("import ", spec)}`)

  for (const d of deps) load(d)

  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
  }).outputText
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, out)
  return require(dest)
}
const jwt = load("lib/jwt.ts")

const prisma = new PrismaClient()
global.__testPrisma = prisma
let pass = 0, fail = 0
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + d}`); c ? pass++ : fail++ }
const TAG = "adminjobs-" + Date.now()
const userIds = []
let jobId = null

// Minimal NextRequest-alike: the handlers only use cookies, url, json() and headers.
const mkReq = (token, { url = "http://localhost/api/admin/jobs", body = null } = {}) => ({
  cookies: { get: (n) => (n === "er_token" && token ? { value: token } : undefined) },
  url,
  headers: { get: () => null },
  json: async () => body,
})

try {
  const seeker = await prisma.user.create({ data: { name: "Seeker", email: `${TAG}-s@t.local`, password: "x", role: "JOBSEEKER" } })
  const employer = await prisma.user.create({ data: { name: "Employer", email: `${TAG}-e@t.local`, password: "x", role: "EMPLOYER" } })
  const adminU = await prisma.user.create({ data: { name: "Admin", email: `${TAG}-a@t.local`, password: "x", role: "ADMIN" } })
  const superU = await prisma.user.create({ data: { name: "Super", email: `${TAG}-su@t.local`, password: "x", role: "SUPER_ADMIN" } })
  userIds.push(seeker.id, employer.id, adminU.id, superU.id)

  const tok = (u) => jwt.signToken({ userId: u.id, email: u.email, role: u.role, paid: false })

  const job = await prisma.job.create({
    data: {
      title: "Admin Control Test Role", description: "A posting used to verify admin controls.",
      company: "TestCo", industry: "Technology", location: "Zurich", type: "FULLTIME",
      postedById: employer.id, active: true,
    },
  })
  jobId = job.id

  const adminApi = load("app/api/admin/jobs/route.ts")
  const jobsApi = load("app/api/jobs/route.ts")

  /* ---- editing ---- */
  let res = await adminApi.PATCH(mkReq(tok(seeker), { body: { jobId, title: "Hacked" } }))
  ok("a job seeker cannot edit a posting", res.status === 403, `status=${res.status}`)

  res = await adminApi.PATCH(mkReq(tok(employer), { body: { jobId, title: "Hacked" } }))
  ok("even the employer cannot use the ADMIN endpoint", res.status === 403, `status=${res.status}`)

  res = await adminApi.PATCH(mkReq(null, { body: { jobId, title: "Hacked" } }))
  ok("an anonymous request cannot edit", res.status === 403, `status=${res.status}`)

  res = await adminApi.PATCH(mkReq(tok(adminU), { body: { jobId, title: "Corrected Title", salary: "CHF 120,000" } }))
  ok("an admin CAN edit", res.status === 200, `status=${res.status}`)
  let fresh = await prisma.job.findUnique({ where: { id: jobId } })
  ok("the edit actually persisted", fresh.title === "Corrected Title" && fresh.salary === "CHF 120,000", fresh.title)

  res = await adminApi.PATCH(mkReq(tok(adminU), { body: { jobId, title: "   " } }))
  ok("an empty title is rejected", res.status === 400, `status=${res.status}`)

  res = await adminApi.PATCH(mkReq(tok(adminU), { body: { jobId, type: "NONSENSE" } }))
  ok("an invalid job type is rejected", res.status === 400, `status=${res.status}`)

  /* ---- the edit is audited WITH previous values ---- */
  const auditEdit = await prisma.activityLog.findFirst({
    where: { userId: adminU.id, action: "job.edit" }, orderBy: { createdAt: "desc" },
  })
  ok("the edit is written to the audit log", !!auditEdit)
  ok("the audit records what changed, including the OLD value",
    !!auditEdit && /Corrected Title/.test(auditEdit.meta || "") && /Admin Control Test Role/.test(auditEdit.meta || ""),
    (auditEdit?.meta || "").slice(0, 160))

  /* ---- archive / restore ---- */
  res = await adminApi.PATCH(mkReq(tok(adminU), { body: { jobId, active: false } }))
  ok("an admin can archive", res.status === 200)
  fresh = await prisma.job.findUnique({ where: { id: jobId } })
  ok("the posting is archived, not deleted", fresh && fresh.active === false)

  /* ---- archived visibility ---- */
  const listFor = async (u, includeArchived) => {
    const url = `http://localhost/api/jobs?q=Corrected%20Title${includeArchived ? "&includeArchived=true" : ""}`
    const r = await jobsApi.GET(mkReq(u ? tok(u) : null, { url }))
    return r.json()
  }
  let d = await listFor(seeker, false)
  ok("an archived posting is hidden from job seekers", !(d.jobs || []).some((j) => j.id === jobId))

  // The flag must be ignored for a non-admin, not honoured because they asked nicely.
  d = await listFor(seeker, true)
  ok("a seeker passing ?includeArchived=true is IGNORED (no leak)", !(d.jobs || []).some((j) => j.id === jobId))
  ok("and the response does not grant them admin capability", d.viewer?.isAdmin === false, JSON.stringify(d.viewer))

  d = await listFor(adminU, true)
  ok("an admin opting in DOES see the archived posting", (d.jobs || []).some((j) => j.id === jobId))
  ok("the server reports admin capability", d.viewer?.isAdmin === true)
  ok("an ADMIN is not granted delete capability", d.viewer?.canDelete === false, JSON.stringify(d.viewer))

  d = await listFor(superU, true)
  ok("a SUPER_ADMIN is granted delete capability", d.viewer?.canDelete === true, JSON.stringify(d.viewer))

  // Restore
  res = await adminApi.PATCH(mkReq(tok(adminU), { body: { jobId, active: true } }))
  fresh = await prisma.job.findUnique({ where: { id: jobId } })
  ok("restore brings it back", fresh.active === true)

  /* ---- deletion is SUPER_ADMIN only ---- */
  res = await adminApi.DELETE(mkReq(tok(adminU), { body: { jobId } }))
  ok("a plain ADMIN cannot permanently delete", res.status === 403, `status=${res.status}`)
  ok("the posting still exists after the refused delete", !!(await prisma.job.findUnique({ where: { id: jobId } })))

  res = await adminApi.DELETE(mkReq(tok(superU), { body: { jobId } }))
  ok("a SUPER_ADMIN can delete", res.status === 200, `status=${res.status}`)
  ok("the posting is gone", !(await prisma.job.findUnique({ where: { id: jobId } })))
  jobId = null

  const auditDel = await prisma.activityLog.findFirst({
    where: { userId: superU.id, action: "job.delete" }, orderBy: { createdAt: "desc" },
  })
  ok("the deletion is audited", !!auditDel)
  ok("the audit snapshot survives the deleted row (title recorded)",
    !!auditDel && /Corrected Title/.test(auditDel.meta || ""), (auditDel?.meta || "").slice(0, 160))

  /* ---- a banned admin loses control immediately ---- */
  await prisma.user.update({ where: { id: adminU.id }, data: { banned: true } })
  const job2 = await prisma.job.create({
    data: {
      title: "Second Test Role", description: "Another posting.", company: "TestCo",
      industry: "Technology", location: "Zurich", type: "FULLTIME", postedById: employer.id,
    },
  })
  jobId = job2.id
  res = await adminApi.PATCH(mkReq(tok(adminU), { body: { jobId, title: "Nope" } }))
  ok("a BANNED admin is refused even with a still-valid token", res.status === 403, `status=${res.status}`)
  d = await listFor(adminU, true)
  ok("and the banned admin is no longer told they are an admin", d.viewer?.isAdmin === false, JSON.stringify(d.viewer))
} catch (e) {
  console.error("ERROR:", e.stack || e.message)
  fail++
} finally {
  try {
    if (jobId) await prisma.job.delete({ where: { id: jobId } }).catch(() => {})
    for (const id of userIds) {
      await prisma.job.deleteMany({ where: { postedById: id } }).catch(() => {})
      await prisma.activityLog.deleteMany({ where: { userId: id } }).catch(() => {})
      await prisma.user.delete({ where: { id } }).catch(() => {})
    }
  } catch {}
  await prisma.$disconnect()
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
