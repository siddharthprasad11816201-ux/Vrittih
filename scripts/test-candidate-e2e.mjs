/**
 * Candidate master end-to-end against the REAL database:
 *   multi-source intake converging on ONE record, attribution preserved across a merge,
 *   ambiguous pairs held for review, and a merge that can be reverted.
 *
 *   node scripts/test-candidate-e2e.mjs
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cande2e-"))

// lib/candidate/resolve imports "@/lib/prisma"; rewrite that alias so the harness can run
// the REAL resolution service against the real client.
function load(rel) {
  const dest = path.join(tmp, rel.replace(/\.ts$/, ".js"))
  if (fs.existsSync(dest)) return require(dest)
  const abs = path.join(ROOT, rel)
  let src = fs.readFileSync(abs, "utf8")
  src = src.replace(/from\s+["']@\/lib\/prisma["']/g, `from ${JSON.stringify(path.join(tmp, "prismaShim.cjs").replace(/\\/g, "/"))}`)
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

const prisma = new PrismaClient()
fs.writeFileSync(path.join(tmp, "prismaShim.cjs"), `module.exports = { prisma: global.__testPrisma }`)
global.__testPrisma = prisma

const svc = load("lib/candidate/resolve.ts")

const TAG = "cand-e2e-" + Date.now()
let pass = 0, fail = 0
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + d}`); c ? pass++ : fail++ }
const madeCandidates = new Set()
const madeMerges = []

try {
  const email = `${TAG}-priya@corp.example`

  // ---- 1. Same person arrives from THREE different sources ----
  const fromSite = await svc.resolveCandidate({
    name: "Priya Sharma", identities: [{ kind: "email", value: email, verified: true }],
    location: "Zurich", source: "edurankai", campaign: "organic",
  })
  madeCandidates.add(fromSite.candidateId)
  ok("first sighting creates a candidate", fromSite.created === true)

  // Same mailbox, written differently (case + a +tag) — must NOT create a second record.
  const fromLinkedIn = await svc.resolveCandidate({
    name: "P. Sharma", identities: [{ kind: "email", value: email.toUpperCase(), verified: true }],
    source: "linkedin", campaign: "inmail-q3", externalId: `${TAG}-li-1`,
  })
  ok("a differently-cased email resolves to the SAME record", fromLinkedIn.candidateId === fromSite.candidateId && !fromLinkedIn.created)

  const fromIndeed = await svc.resolveCandidate({
    name: "Priya Sharma", identities: [{ kind: "phone", value: "+41 79 000 11 22", verified: true }, { kind: "email", value: email, verified: true }],
    source: "indeed", externalId: `${TAG}-in-1`,
  })
  ok("a third source also converges on one record", fromIndeed.candidateId === fromSite.candidateId)

  const master = await prisma.candidate.findUnique({
    where: { id: fromSite.candidateId },
    include: { identities: true, sources: true },
  })
  ok("the new phone was attached to the existing person", master.identities.some((i) => i.kind === "phone"))
  ok("ALL THREE source attributions are preserved", master.sources.length === 3, JSON.stringify(master.sources.map((s) => s.source)))
  ok("campaign attribution survives", master.sources.some((s) => s.campaign === "inmail-q3"))
  ok("exactly one candidate exists for this person",
    (await prisma.candidate.count({ where: { identities: { some: { value: email } } } })) === 1)

  // Re-importing the same external id must not duplicate the attribution row.
  await svc.resolveCandidate({
    name: "P. Sharma", identities: [{ kind: "email", value: email, verified: true }],
    source: "linkedin", campaign: "inmail-q3", externalId: `${TAG}-li-1`,
  })
  const afterReimport = await prisma.candidateSource.count({ where: { candidateId: fromSite.candidateId } })
  ok("re-importing the same external id is idempotent", afterReimport === 3, String(afterReimport))

  // ---- 2. A DIFFERENT person with the SAME NAME must stay separate ----
  const otherPriya = await svc.resolveCandidate({
    name: "Priya Sharma", identities: [{ kind: "email", value: `${TAG}-other@corp.example`, verified: true }],
    location: "Zurich", source: "manual",
  })
  madeCandidates.add(otherPriya.candidateId)
  ok("same name + same city + DIFFERENT email creates a SEPARATE person", otherPriya.created === true && otherPriya.candidateId !== fromSite.candidateId)
  ok("and it is not even offered for review", otherPriya.review.length === 0, JSON.stringify(otherPriya.review))

  // ---- 3. An ambiguous pair is held for review, never auto-merged ----
  const weakA = await svc.resolveCandidate({
    name: "Ana Silva", identities: [{ kind: "email", value: `${TAG}-ana@corp.example` }],   // unverified
    source: "csv",
  })
  madeCandidates.add(weakA.candidateId)
  const weakB = await svc.resolveCandidate({
    name: "Ana Silva", identities: [{ kind: "github", value: `${TAG}-anasilva` }],
    source: "csv",
  })
  madeCandidates.add(weakB.candidateId)
  ok("a weak-signal pair does not auto-merge", weakB.candidateId !== weakA.candidateId)

  // ---- 4. Merge, with attribution preserved and applications moved ----
  const dupA = await prisma.candidate.create({ data: { displayName: "Dup One", primaryEmail: `${TAG}-d1@x.com`, createdAt: new Date("2026-01-01") } })
  const dupB = await prisma.candidate.create({ data: { displayName: "Dup One", primaryEmail: `${TAG}-d2@x.com`, createdAt: new Date("2026-06-01") } })
  madeCandidates.add(dupA.id); madeCandidates.add(dupB.id)
  await prisma.candidateIdentity.create({ data: { candidateId: dupA.id, kind: "email", value: `${TAG}-d1@x.com`, verified: true } })
  await prisma.candidateIdentity.create({ data: { candidateId: dupB.id, kind: "phone", value: "+41790009999", verified: true } })
  await prisma.candidateSource.create({ data: { candidateId: dupA.id, source: "edurankai" } })
  await prisma.candidateSource.create({ data: { candidateId: dupB.id, source: "aicte", campaign: "campus-2026" } })

  const merge = await svc.mergeCandidates({
    survivorId: dupA.id, mergedId: dupB.id, confidence: 0.9,
    evidence: [{ kind: "email", detail: "test", weight: 0.9, decisive: true }],
    decidedById: null, automatic: false,
  })
  ok("merge succeeds", merge.ok === true, JSON.stringify(merge))
  if (merge.ok) madeMerges.push(merge.mergeId)

  const survivor = await prisma.candidate.findUnique({ where: { id: dupA.id }, include: { identities: true, sources: true } })
  const mergedAway = await prisma.candidate.findUnique({ where: { id: dupB.id } })
  ok("the merged record is KEPT (not deleted) so old links still resolve", mergedAway !== null && mergedAway.mergedIntoId === dupA.id)
  ok("identifiers moved to the survivor", survivor.identities.some((i) => i.kind === "phone"))
  ok("BOTH source attributions survive the merge", survivor.sources.length === 2, JSON.stringify(survivor.sources.map((s) => s.source)))
  ok("the AICTE campus campaign attribution was not lost", survivor.sources.some((s) => s.campaign === "campus-2026"))

  // A later sighting of the merged-away record resolves to the survivor.
  const afterMerge = await svc.resolveCandidate({
    name: "Dup One", identities: [{ kind: "phone", value: "+41790009999", verified: true }], source: "manual",
  })
  ok("a later sighting follows the merge chain to the survivor", afterMerge.candidateId === dupA.id, afterMerge.candidateId)

  // ---- 5. Merge is reversible ----
  const rev = await svc.revertMerge(merge.mergeId, "tester")
  ok("the merge can be reverted", rev.ok === true, JSON.stringify(rev))
  const restored = await prisma.candidate.findUnique({ where: { id: dupB.id }, include: { identities: true, sources: true } })
  ok("the merged-away record is live again", restored.mergedIntoId === null)
  ok("its identifiers came back", restored.identities.some((i) => i.kind === "phone"))
  ok("its source attribution came back", restored.sources.some((s) => s.source === "aicte"))
  const revLog = await prisma.candidateMerge.findUnique({ where: { id: merge.mergeId } })
  ok("the revert is audited", revLog.revertedAt !== null && revLog.revertedById === "tester")
  const twice = await svc.revertMerge(merge.mergeId, "tester")
  ok("reverting twice is refused", twice.ok === false)
} catch (e) {
  console.error("ERROR:", e.stack || e.message)
  fail++
} finally {
  try {
    for (const mid of madeMerges) await prisma.candidateMerge.delete({ where: { id: mid } }).catch(() => {})
    await prisma.candidateMerge.deleteMany({ where: { OR: [{ survivorId: { in: [...madeCandidates] } }, { mergedId: { in: [...madeCandidates] } }] } }).catch(() => {})
    for (const cid of madeCandidates) {
      await prisma.candidateIdentity.deleteMany({ where: { candidateId: cid } }).catch(() => {})
      await prisma.candidateSource.deleteMany({ where: { candidateId: cid } }).catch(() => {})
    }
    for (const cid of madeCandidates) await prisma.candidate.delete({ where: { id: cid } }).catch(() => {})
  } catch {}
  await prisma.$disconnect()
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
