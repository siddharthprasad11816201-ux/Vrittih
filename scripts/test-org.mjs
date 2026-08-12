/**
 * Organizational talent graph tests.
 * The governing rule under test (§57): PREVIOUS / CURRENT / UPCOMING / FORECAST must never
 * be mixed — in particular, FORECAST demand must never be counted as approved headcount.
 *
 *   node scripts/test-org.mjs
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "org-"))
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
let pass = 0, fail = 0
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + d}`); c ? pass++ : fail++ }
const eq = (n, g, w) => ok(n, JSON.stringify(g) === JSON.stringify(w), `got=${JSON.stringify(g)} want=${JSON.stringify(w)}`)

const g = load("lib/org/graph.ts")
const sup = load("lib/org/supply.ts")
const NOW = new Date("2026-08-12T00:00:00Z")

/* ---------------- tree nesting ---------------- */
ok("an organization may be a root", g.canNest("ORGANIZATION", null).ok)
ok("a department may NOT be a root", !g.canNest("DEPARTMENT", null).ok)
ok("a department nests under an organization", g.canNest("DEPARTMENT", "ORGANIZATION").ok)
ok("a team nests under a department", g.canNest("TEAM", "DEPARTMENT").ok)
ok("an organization cannot nest inside a team", !g.canNest("ORGANIZATION", "TEAM").ok)

const units = [
  { id: "org", parentId: null, kind: "ORGANIZATION", name: "Acme" },
  { id: "eng", parentId: "org", kind: "DEPARTMENT", name: "Engineering" },
  { id: "plat", parentId: "eng", kind: "TEAM", name: "Platform" },
  { id: "sales", parentId: "org", kind: "DEPARTMENT", name: "Sales" },
]
eq("path is root-first", g.pathOf(units, "plat").map((u) => u.name), ["Acme", "Engineering", "Platform"])
eq("a subtree includes descendants", g.subtreeIds(units, "eng").sort(), ["eng", "plat"])
eq("a leaf subtree is just itself", g.subtreeIds(units, "sales"), ["sales"])
ok("re-parenting a unit under its own child is refused", g.wouldCycle(units, "eng", "plat"))
ok("a unit cannot become its own parent", g.wouldCycle(units, "eng", "eng"))
ok("a legal move is allowed", !g.wouldCycle(units, "plat", "sales"))
// A corrupt parent link must not hang the request.
const cyclic = [{ id: "a", parentId: "b", kind: "TEAM", name: "A" }, { id: "b", parentId: "a", kind: "TEAM", name: "B" }]
ok("a cyclic tree does not hang pathOf", g.pathOf(cyclic, "a").length <= 2)

/* ---------------- THE temporal rule ---------------- */
const P = (state, from, to) => ({ state, effectiveFrom: from, effectiveTo: to })
eq("a filled seat is CURRENT", g.temporalOf(P("FILLED", "2026-01-01", null), NOW), "CURRENT")
eq("an already-effective vacancy is CURRENT", g.temporalOf(P("OPEN", "2026-01-01", null), NOW), "CURRENT")
eq("a vacancy starting later is UPCOMING", g.temporalOf(P("OPEN", "2026-12-01", null), NOW), "UPCOMING")
eq("a planned role with no date is UPCOMING, not CURRENT", g.temporalOf(P("PLANNED", null, null), NOW), "UPCOMING")
eq("a forecast role is FORECAST", g.temporalOf(P("FORECAST", null, null), NOW), "FORECAST")
eq("a closed role is PREVIOUS", g.temporalOf(P("CLOSED", "2026-01-01", null), NOW), "PREVIOUS")
eq("an ended window is PREVIOUS whatever the state says", g.temporalOf(P("FILLED", "2025-01-01", "2026-01-01"), NOW), "PREVIOUS")
eq("an ended window beats FORECAST too", g.temporalOf(P("FORECAST", null, "2026-01-01"), NOW), "PREVIOUS")
// Totality: an unrecognised state must never fall through to CURRENT.
eq("an unknown state is never CURRENT", g.temporalOf(P("WEIRD", null, null), NOW), "UPCOMING")

const all = [
  P("FILLED", "2026-01-01", null), P("OPEN", "2026-01-01", null),
  P("OPEN", "2026-12-01", null), P("PLANNED", null, null),
  P("FORECAST", null, null), P("CLOSED", "2025-01-01", null),
]
const buckets = g.bucketByTemporal(all, NOW)
eq("every position lands in exactly one bucket",
  buckets.PREVIOUS.length + buckets.CURRENT.length + buckets.UPCOMING.length + buckets.FORECAST.length, all.length)
eq("CURRENT holds only the two live rows", buckets.CURRENT.length, 2)
eq("UPCOMING holds the future vacancy and the planned role", buckets.UPCOMING.length, 2)
eq("FORECAST is isolated", buckets.FORECAST.length, 1)

const hc = g.headcount([
  { state: "FILLED", headcount: 3 }, { state: "OPEN", headcount: 2 },
  { state: "PLANNED", headcount: 5 }, { state: "FORECAST", headcount: 100 },
  { state: "CLOSED", effectiveTo: "2025-01-01", headcount: 9 },
], NOW)
eq("filled counted", hc.filled, 3)
eq("open counted", hc.open, 2)
eq("upcoming counted", hc.upcoming, 5)
eq("forecast counted separately", hc.forecast, 100)
// THE headline property: a 100-person forecast must not inflate approved headcount.
eq("approved = filled + open + upcoming ONLY", hc.approved, 10)
ok("forecast is excluded from approved headcount", hc.approved < hc.forecast)
eq("history is not counted as current", hc.previous, 9)
ok("isApprovedHeadcount excludes FORECAST", g.isApprovedHeadcount("UPCOMING") && !g.isApprovedHeadcount("FORECAST"))

/* ---------------- supply & demand ---------------- */
const positions = [
  { id: "p1", title: "ML Engineer", orgUnitId: "eng", state: "OPEN", effectiveFrom: "2026-01-01", headcount: 2, skills: ["PyTorch", "Python"] },
  { id: "p2", title: "AI Researcher", orgUnitId: "eng", state: "FORECAST", headcount: 5, skills: ["PyTorch"] },
  { id: "p3", title: "Staff Eng", orgUnitId: "eng", state: "FILLED", headcount: 1, skills: ["Python"] },
  { id: "p4", title: "AE", orgUnitId: "sales", state: "OPEN", effectiveFrom: "2026-01-01", headcount: 1, skills: ["Sales"] },
]
const people = [
  { id: "u1", kind: "employee", skills: { python: 0.9 } },
  { id: "u2", kind: "candidate", skills: { python: 0.8, pytorch: 0.7 } },
  { id: "u3", kind: "candidate", skills: { pytorch: 0.3 } },   // below the bar
]
const demand = sup.skillDemand(positions, people, NOW)
const pytorch = demand.find((d) => d.skill === "pytorch")
const python = demand.find((d) => d.skill === "python")
eq("approved demand counts only the open role", pytorch.approvedDemand, 2)
eq("forecast demand is tracked separately, never merged", pytorch.forecastDemand, 5)
eq("only supply at or above the bar counts", pytorch.supply, 1)
eq("gap uses approved demand only", pytorch.gap, 1)
// A FILLED seat is not demand — counting it would invent a shortage.
eq("a filled seat contributes no demand", python.approvedDemand, 2)
ok("skills are sorted worst-gap first", demand[0].gap >= demand[demand.length - 1].gap)

const gaps = sup.unitGaps(positions, people, NOW)
const eng = gaps.find((u) => u.orgUnitId === "eng")
const sales = gaps.find((u) => u.orgUnitId === "sales")
eq("engineering approved openings exclude the filled seat and the forecast", eng.approvedOpenings, 2)
eq("engineering forecast openings are separate", eng.forecastOpenings, 5)
ok("sales has zero coverage (nobody has the skill)", sales.coverage === 0, String(sales.coverage))
ok("the worst-covered department sorts first", gaps[0].coverage <= (gaps[gaps.length - 1].coverage ?? 1))

const supplyRoles = sup.roleSupply(positions.filter((p) => p.state !== "FILLED"), people, NOW, { target: 2 })
const ml = supplyRoles.find((r) => r.positionId === "p1")
eq("the ML role reports its temporal bucket", ml.temporal, "CURRENT")
ok("only one person covers enough of the ML role", ml.qualified === 1, String(ml.qualified))
ok("an under-supplied role is flagged", !ml.sufficient)
ok("the best match is listed first", ml.top[0].personId === "u2", JSON.stringify(ml.top[0]))
ok("missing skills are named for the shortfall", Array.isArray(ml.top[0].missing))

// A role with no recorded skills is UNASSESSABLE, not "fully covered".
const noSkills = sup.roleSupply([{ id: "p9", title: "Mystery", state: "OPEN", effectiveFrom: "2026-01-01", skills: [] }], people, NOW)
ok("a role with no skills is never reported as sufficient", noSkills[0].sufficient === false)
eq("and it has no qualified count to boast", noSkills[0].qualified, 0)

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
