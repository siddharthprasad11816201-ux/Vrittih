/**
 * Candidate master tests — identity normalization and duplicate resolution.
 * The governing rule under test: a NAME MATCH ALONE MUST NEVER MERGE TWO PEOPLE.
 *
 *   node scripts/test-candidate.mjs
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cand-"))
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

const id = load("lib/candidate/identity.ts")
const mt = load("lib/candidate/match.ts")

/* ---------------- identity normalization ---------------- */
eq("email is case-folded", id.normalizeEmail("Priya.Sharma@Example.COM"), "priya.sharma@example.com")
eq("gmail ignores dots", id.normalizeEmail("priya.sharma@gmail.com"), "priyasharma@gmail.com")
eq("gmail ignores +tags", id.normalizeEmail("priyasharma+jobs@gmail.com"), "priyasharma@gmail.com")
eq("googlemail folds into gmail", id.normalizeEmail("priya.sharma@googlemail.com"), "priyasharma@gmail.com")
// Dot-folding non-Gmail domains would WRONGLY merge distinct people.
ok("non-gmail domains keep their dots (a.b@corp != ab@corp)",
  id.normalizeEmail("a.b@corp.com") !== id.normalizeEmail("ab@corp.com"))
eq("+tags are stripped everywhere", id.normalizeEmail("ab+x@corp.com"), "ab@corp.com")
eq("garbage email is rejected", id.normalizeEmail("not-an-email"), null)

eq("phone normalizes to +digits", id.normalizePhone("+41 79 123 45 67"), "+41791234567")
eq("00 prefix is treated as +", id.normalizePhone("0041791234567"), "+41791234567")
eq("too-short numbers are rejected", id.normalizePhone("12345"), null)
ok("a national number matches its international form", id.phonesMatch("+41791234567", "+791234567") || id.phonesMatch("+41791234567", "791234567"))
ok("short suffixes never collide", !id.phonesMatch("+41791234567", "4567"))
ok("different numbers do not match", !id.phonesMatch("+41791234567", "+41791234568"))

eq("linkedin URL reduces to a slug", id.normalizeLinkedIn("https://www.linkedin.com/in/Priya-Sharma-123/"), "priya-sharma-123")
eq("a bare slug is accepted", id.normalizeLinkedIn("priya-sharma-123"), "priya-sharma-123")
eq("github URL reduces to a username", id.normalizeGithub("https://github.com/PriyaS"), "priyas")

eq("accents and punctuation are stripped from names", id.normalizeName("José O'Neill-Smith"), "jose oneill smith")
// Apostrophes JOIN so the two common spellings agree; hyphens SPLIT.
eq("O'Neill and ONeill normalize identically", id.normalizeName("O'Neill"), id.normalizeName("ONeill"))
eq("hyphenated surnames split into tokens", id.normalizeName("Oneill-Smith"), "oneill smith")
eq("name order does not matter", id.nameSimilarity("Priya Sharma", "Sharma Priya"), 1)
ok("different names score low", id.nameSimilarity("Priya Sharma", "John Smith") < 0.2)
ok("common names are less distinctive than rare ones",
  id.nameDistinctiveness("John Smith") < id.nameDistinctiveness("Xanthe Quibblesworth"))

/* ---------------- THE core safety property ---------------- */
const twoJohns = mt.compareCandidates(
  { id: "a", name: "John Smith", identities: [{ kind: "email", value: "john1@corp.com", verified: true }] },
  { id: "b", name: "John Smith", identities: [{ kind: "email", value: "john2@corp.com", verified: true }] },
)
eq("SAME NAME + DIFFERENT EMAIL => DIFFERENT (never merged)", twoJohns.verdict, "DIFFERENT")
ok("and it does not even reach review", twoJohns.confidence < mt.REVIEW_THRESHOLD, String(twoJohns.confidence))

const nameAndCity = mt.compareCandidates(
  { id: "a", name: "Priya Sharma", identities: [], location: "Zurich" },
  { id: "b", name: "Priya Sharma", identities: [], location: "Zurich" },
)
eq("identical name + city + no identifier => DIFFERENT", nameAndCity.verdict, "DIFFERENT")
ok("name+location alone cannot reach the review bar", nameAndCity.confidence < mt.REVIEW_THRESHOLD, String(nameAndCity.confidence))

/* ---------------- genuine duplicates ---------------- */
const sameEmail = mt.compareCandidates(
  { id: "a", name: "Priya Sharma", identities: [{ kind: "email", value: "priya@corp.com", verified: true }] },
  { id: "b", name: "P. Sharma", identities: [{ kind: "email", value: "priya@corp.com", verified: true }] },
)
eq("same VERIFIED email => SAME", sameEmail.verdict, "SAME")
ok("confidence clears the auto-merge bar", sameEmail.confidence >= mt.AUTO_MERGE_THRESHOLD, String(sameEmail.confidence))
ok("the evidence names the matching identifier", sameEmail.evidence.some((e) => e.kind === "email" && e.decisive))

const unverifiedEmail = mt.compareCandidates(
  { id: "a", name: "Priya Sharma", identities: [{ kind: "email", value: "priya@corp.com" }] },
  { id: "b", name: "Priya Sharma", identities: [{ kind: "email", value: "priya@corp.com" }] },
)
eq("same UNVERIFIED email => REVIEW, not an automatic merge", unverifiedEmail.verdict, "REVIEW")
ok("the review reason explains what to check", !!unverifiedEmail.reviewReason)

const samePhone = mt.compareCandidates(
  { id: "a", name: "Ana Silva", identities: [{ kind: "phone", value: "+41791234567", verified: true }] },
  { id: "b", name: "Ana Silva", identities: [{ kind: "phone", value: "+41791234567", verified: true }] },
)
eq("same verified phone => SAME", samePhone.verdict, "SAME")

const sameLinkedIn = mt.compareCandidates(
  { id: "a", name: "Ana Silva", identities: [{ kind: "linkedin", value: "ana-silva", verified: true }] },
  { id: "b", name: "A. Silva", identities: [{ kind: "linkedin", value: "ana-silva", verified: true }] },
)
ok("same verified LinkedIn merges or reviews, never DIFFERENT", sameLinkedIn.verdict !== "DIFFERENT", sameLinkedIn.verdict)

// A weak identifier alone must not auto-merge.
const sameGithub = mt.compareCandidates(
  { id: "a", name: "Dev One", identities: [{ kind: "github", value: "devone", verified: true }] },
  { id: "b", name: "Dev Two", identities: [{ kind: "github", value: "devone", verified: true }] },
)
ok("github alone is not decisive (review at most)", sameGithub.verdict !== "SAME", sameGithub.verdict)

// Corroboration can lift a strong signal but never manufacture one.
const corroborated = mt.compareCandidates(
  { id: "a", name: "Priya Sharma", identities: [{ kind: "email", value: "p@corp.com" }], location: "Zurich", currentEmployer: "Acme" },
  { id: "b", name: "Priya Sharma", identities: [{ kind: "email", value: "p@corp.com" }], location: "Zurich", currentEmployer: "Acme" },
)
ok("corroboration raises confidence above the bare-identifier case", corroborated.confidence > unverifiedEmail.confidence)

/* ---------------- masking ---------------- */
ok("emails are masked in review evidence", !mt.maskValue("email", "priya@corp.com").includes("priya"))
ok("the domain is still visible for judgement", mt.maskValue("email", "priya@corp.com").includes("corp.com"))
ok("phones show only the last digits", mt.maskValue("phone", "+41791234567") === "***4567")

/* ---------------- merge planning ---------------- */
const older = { id: "old", createdAt: new Date("2026-01-01"), identities: [{ kind: "email", value: "a@x.com", verified: true }], sourceCount: 2 }
const newer = { id: "new", createdAt: new Date("2026-06-01"), identities: [{ kind: "phone", value: "+41791234567", verified: true }], sourceCount: 1 }
const plan = mt.planMerge(newer, older)
eq("the OLDER record survives (longest history)", plan.survivorId, "old")
eq("the newer record is the one merged away", plan.mergedId, "new")
eq("its identifiers move across", plan.identitiesToMove.length, 1)
eq("ALL source attributions are preserved, never collapsed", plan.preserveSourceCount, 3)

const conflicting = mt.planMerge(
  { id: "a", createdAt: new Date("2026-01-01"), identities: [{ kind: "national_id", value: "AAA111", verified: true }], sourceCount: 1 },
  { id: "b", createdAt: new Date("2026-02-01"), identities: [{ kind: "national_id", value: "BBB222", verified: true }], sourceCount: 1 },
)
ok("conflicting verified national IDs raise a warning", conflicting.warnings.length > 0, JSON.stringify(conflicting.warnings))

/* ---------------- duplicate search ---------------- */
const pool = [
  { id: "x", name: "Priya Sharma", identities: [{ kind: "email", value: "priya@corp.com", verified: true }] },
  { id: "y", name: "John Smith", identities: [{ kind: "email", value: "john@corp.com", verified: true }] },
]
const dups = mt.findDuplicates({ id: "s", name: "Priya S", identities: [{ kind: "email", value: "priya@corp.com", verified: true }] }, pool)
eq("only the genuine duplicate is returned", dups.length, 1)
eq("and it is the right record", dups[0].candidate.id, "x")
ok("results are ordered by confidence", dups.every((d, i) => i === 0 || d.match.confidence <= dups[i - 1].match.confidence))

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
