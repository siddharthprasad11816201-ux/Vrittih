/**
 * Tier & visibility tests.
 *
 * Two real defects are locked down here:
 *  1. An ANONYMOUS visitor was shown the entire member navigation (Career AI, Academy,
 *     Mentoring, Applications, Account) and a "Sign out" button, because buildNav read an
 *     empty capability set as "a job seeker with no add-ons".
 *  2. BASIC had everything unlocked — the advanced career, learning, research and AI
 *     surfaces were rendered for every tier, leaving nothing for Pro to sell.
 *
 *   node scripts/test-tiers.mjs
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tier-"))

// Resolve the "@/lib/..." alias into the temp tree so the real modules load unmodified.
function load(rel) {
  const dest = path.join(tmp, rel.replace(/\.ts$/, ".js"))
  if (fs.existsSync(dest)) return require(dest)
  const abs = path.join(ROOT, rel)
  const raw = fs.readFileSync(abs, "utf8")

  for (const m of raw.matchAll(/from\s+["']@\/lib\/([^"']+)["']/g)) {
    const dep = "lib/" + m[1] + ".ts"
    if (fs.existsSync(path.join(ROOT, dep))) load(dep)
  }
  for (const m of raw.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const depRel = path.relative(ROOT, path.resolve(path.dirname(abs), m[1])).replace(/\\/g, "/")
    if (fs.existsSync(path.join(ROOT, depRel + ".ts"))) load(depRel + ".ts")
  }

  const here = path.dirname(dest)
  const src = raw.replace(/from\s+["']@\/lib\/([^"']+)["']/g, (_m, p) => {
    const target = path.join(tmp, "lib", p)
    let r = path.relative(here, target).replace(/\\/g, "/")
    if (!r.startsWith(".")) r = "./" + r
    return `from "${r}"`
  })

  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
  }).outputText
  fs.mkdirSync(here, { recursive: true })
  fs.writeFileSync(dest, out)
  return require(dest)
}

const d = load("lib/capability/derive.ts")
let pass = 0, fail = 0
const ok = (n, c, x = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + x}`); c ? pass++ : fail++ }

/* ---------------- anonymous ---------------- */
ok("an anonymous visitor holds NO capabilities", d.deriveCapabilities(null).size === 0)
ok("a user object with no id is still anonymous", d.deriveCapabilities({ role: "JOBSEEKER", plan: "pro" }).size === 0)

/* ---------------- Basic: fundamentals only ---------------- */
const basic = d.deriveCapabilities({ id: "u1", role: "JOBSEEKER", plan: "basic" })
ok("Basic can browse jobs", basic.has("jobs.browse"))
ok("Basic can apply", basic.has("jobs.apply"))
ok("Basic can save jobs", basic.has("jobs.save"))
ok("Basic can build a résumé", basic.has("resume.build"))
ok("Basic does NOT get career intelligence", !basic.has("career.advanced"))
ok("Basic does NOT get academy / mentoring", !basic.has("learning.advanced"))
ok("Basic does NOT get research & innovation", !basic.has("research.access"))
ok("Basic does NOT get the advanced AI suite", !basic.has("advanced.ai"))
ok("Basic does NOT get professional networking", !basic.has("network.access"))
ok("Basic gets no employer powers", !basic.has("jobs.post") && !basic.has("hrms.view"))
ok("Basic gets no admin powers", !basic.has("admin.access"))

/* ---------------- Pro: the advanced suites ---------------- */
const pro = d.deriveCapabilities({ id: "u2", role: "JOBSEEKER", plan: "pro" })
ok("Pro unlocks career intelligence", pro.has("career.advanced"))
ok("Pro unlocks academy / mentoring", pro.has("learning.advanced"))
ok("Pro unlocks research & innovation", pro.has("research.access"))
ok("Pro unlocks the advanced AI suite", pro.has("advanced.ai"))
ok("Pro unlocks networking", pro.has("network.access"))
// Upgrading must never REMOVE something, or a paying user loses a feature.
ok("Pro is a strict superset of Basic", [...basic].every((c) => pro.has(c)))
ok("Pro still gets no employer powers", !pro.has("jobs.post"))
ok("Pro still gets no admin powers", !pro.has("admin.access"))

/* ---------------- employers ---------------- */
const starter = d.deriveCapabilities({ id: "e1", role: "EMPLOYER", plan: "emp_starter" })
ok("Starter can post jobs", starter.has("jobs.post"))
ok("Starter does not get HRMS (Growth and up)", !starter.has("hrms.view"))
const scale = d.deriveCapabilities({ id: "e2", role: "EMPLOYER", plan: "emp_scale" })
ok("Scale gets HRMS and the API", scale.has("hrms.view") && scale.has("api.keys"))

/* ---------------- admins ---------------- */
const admin = d.deriveCapabilities({ id: "a1", role: "SUPER_ADMIN", plan: null })
ok("an admin can reach every surface for support", admin.has("career.advanced") && admin.has("advanced.ai") && admin.has("research.access"))
ok("a super admin is flagged as such", admin.has("admin.super"))

/* ---------------- the nav itself ---------------- */
const shell = fs.readFileSync(path.join(ROOT, "components/vrittih/AppShell.tsx"), "utf8")
ok("buildNav requires an explicit signedIn argument", /function buildNav\(caps: Set<string>, signedIn: boolean\)/.test(shell))
ok("buildNav returns a public nav when signed out", /if \(!signedIn\)/.test(shell))
ok("the nav is built from the real session, not a guess", shell.includes("buildNav(caps, !!user)"))
ok("advanced career items are capability-gated", shell.includes('can("career.advanced")'))
ok("learning items are capability-gated", shell.includes('can("learning.advanced")'))
ok("research items are capability-gated", shell.includes('can("research.access")'))
ok("advanced AI items are capability-gated", shell.includes('can("advanced.ai")'))
ok("a signed-out visitor is offered Sign in, not Sign out", /!user \? \(/.test(shell) && shell.includes("Sign in"))


/* ---------------- Guaranteed Hire ---------------- */
const g = load("lib/hire/guarantee.ts")

ok("the advertised entry price is CHF 150", g.BASE_PRICE_CHF === 150)
const q1 = g.quoteFor({ headcount: 1, seniority: "mid", urgencyDays: 30 })
ok("a quote never falls below the advertised entry price", q1.amountCHF >= 150, String(q1.amountCHF))
ok("seniority raises the quote",
  g.quoteFor({ headcount: 1, seniority: "executive" }).amountCHF > g.quoteFor({ headcount: 1, seniority: "junior" }).amountCHF)
ok("extra hires cost less than the first (shared sourcing)",
  g.quoteFor({ headcount: 2, seniority: "mid" }).amountCHF < g.quoteFor({ headcount: 1, seniority: "mid" }).amountCHF * 2)
ok("a rush search costs more", g.quoteFor({ headcount: 1, seniority: "mid", urgencyDays: 7 }).amountCHF > q1.amountCHF)
ok("the quote itemises what drives it", q1.breakdown.length >= 1)

// The promise must be DEFINED, not an unqualified absolute claim.
const terms = g.termsFor(q1)
ok("terms carry a version so a deal cannot be silently rewritten", terms.version === g.TERMS_VERSION)
ok("the promise states a concrete window", /\d+ days/.test(terms.promise))
ok("the terms list real conditions", terms.conditions.length >= 3)
ok("a replacement window is included", terms.replacementDays > 0)

// SLA state
const NOW = new Date("2026-08-14T00:00:00Z")
const notStarted = g.guaranteeState({ acceptedAt: null, guaranteeDays: 30, now: NOW })
ok("an unaccepted engagement has no clock running", notStarted.state === "NOT_STARTED")
const onTrack = g.guaranteeState({ acceptedAt: new Date("2026-08-12"), guaranteeDays: 30, now: NOW })
ok("early in the window is ON_TRACK", onTrack.state === "ON_TRACK", onTrack.state)
const atRisk = g.guaranteeState({ acceptedAt: new Date("2026-07-20"), guaranteeDays: 30, now: NOW })
ok("past 75% of the window is AT_RISK, before the promise breaks", atRisk.state === "AT_RISK", atRisk.state)
const breached = g.guaranteeState({ acceptedAt: new Date("2026-06-01"), guaranteeDays: 30, now: NOW })
ok("past the deadline is BREACHED", breached.state === "BREACHED", breached.state)
const filled = g.guaranteeState({ acceptedAt: new Date("2026-06-01"), filledAt: new Date("2026-06-10"), guaranteeDays: 30, now: NOW })
ok("a filled role is FULFILLED regardless of elapsed time", filled.state === "FULFILLED")

// Fill-or-free must actually zero the bill.
ok("a missed guarantee waives the fee entirely", g.billableAmount(terms, "BREACHED") === 0)
ok("an on-track engagement bills the agreed amount", g.billableAmount(terms, "ON_TRACK") === terms.amountCHF)
ok("a fulfilled engagement bills the agreed amount", g.billableAmount(terms, "FULFILLED") === terms.amountCHF)

// Homepage copy must carry the terms, not an unqualified absolute claim.
const home = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8")
ok("the homepage shows the pack", home.includes("Guaranteed Hire") || home.includes("We fill the role"))
ok("the homepage states the entry price", home.includes("CHF 150"))
ok("the homepage states the qualifying terms", home.includes("does not apply if the role is withdrawn"))
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
